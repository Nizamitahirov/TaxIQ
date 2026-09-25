'use client';

/** Qeyri-maddi aktivlər (IAS 38) — əməliyyat №9. Amortizasiya: Dt 721 / Kt 101. */
import { listByCompany, createDoc, updateDocById, deleteDocById } from './firestore';
import { listAccounts, postJournalEntry } from './accounting';
import { logAudit } from './audit';
import type { IntangibleAsset } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

export const listIntangibleAssets = (companyId: string) =>
  listByCompany<IntangibleAsset>('intangibleAssets', companyId);

export async function createIntangibleAsset(input: Omit<IntangibleAsset, 'id' | 'accumulatedAmortization' | 'netBookValue' | 'status'> & { createdBy: string }): Promise<string> {
  const { createdBy, ...a } = input;
  const id = await createDoc('intangibleAssets', {
    ...a, accumulatedAmortization: 0, netBookValue: a.acquisitionCost, status: 'active', createdBy,
  });
  await logAudit({ companyId: a.companyId, userId: createdBy, action: 'INTANGIBLE_CREATED', entityType: 'intangibleAsset', entityId: id, after: { name: a.assetName, cost: a.acquisitionCost } });
  return id;
}

export async function updateIntangibleAsset(id: string, patch: Partial<IntangibleAsset>): Promise<void> {
  await updateDocById('intangibleAssets', id, patch);
}

export async function deleteIntangibleAsset(a: IntangibleAsset, actorUid: string): Promise<void> {
  await deleteDocById('intangibleAssets', a.id);
  await logAudit({ companyId: a.companyId, userId: actorUid, action: 'INTANGIBLE_DELETED', entityType: 'intangibleAsset', entityId: a.id });
}

/** Aylıq amortizasiya (düz xətli). Qeyri-müəyyən faydalı müddət → amortizasiya olunmur. */
export function monthlyAmortization(a: IntangibleAsset): number {
  if (a.status !== 'active' || a.indefiniteLife || !a.usefulLifeMonths) return 0;
  return round2(Math.max(0, a.acquisitionCost / a.usefulLifeMonths));
}

/**
 * Aylıq amortizasiyanı icra edir: konsolidasiya jurnal (Dt 721 / Kt 101)
 * + hər aktivin accumulatedAmortization/netBookValue yenilənməsi.
 */
export async function runAmortization(companyId: string, userId: string): Promise<{ total: number; entryId: string | null }> {
  const accounts = await listAccounts(companyId);
  const expense = accounts.find((a) => a.accountCode === '721');
  const intangible = accounts.find((a) => a.accountCode === '101');
  if (!expense || !intangible) throw new Error('Hesablar Planı qurulmayıb (721/101 tapılmadı)');

  const assets = (await listIntangibleAssets(companyId)).filter((a) => a.status === 'active');
  let total = 0;
  const updates: { id: string; accumulated: number; nbv: number; status: IntangibleAsset['status'] }[] = [];
  for (const a of assets) {
    let amt = monthlyAmortization(a);
    const maxAmt = round2(a.acquisitionCost - a.accumulatedAmortization);
    if (amt > maxAmt) amt = maxAmt;
    if (amt <= 0) continue;
    const accumulated = round2(a.accumulatedAmortization + amt);
    const nbv = round2(a.acquisitionCost - accumulated);
    updates.push({ id: a.id, accumulated, nbv, status: nbv <= 0 ? 'fully_amortized' : 'active' });
    total += amt;
  }
  total = round2(total);
  if (total <= 0) return { total: 0, entryId: null };

  const today = new Date().toISOString().slice(0, 10);
  const entryId = await postJournalEntry({
    companyId, entryDate: today, description: 'Aylıq amortizasiya — qeyri-maddi aktivlər (konsolidasiya)',
    sourceType: 'amortization',
    lines: [
      { accountId: expense.id, accountCode: expense.accountCode, accountName: expense.accountName.az, debit: total, credit: 0 },
      { accountId: intangible.id, accountCode: intangible.accountCode, accountName: intangible.accountName.az, debit: 0, credit: total },
    ],
    createdBy: userId,
  });
  for (const u of updates) {
    await updateDocById('intangibleAssets', u.id, { accumulatedAmortization: u.accumulated, netBookValue: u.nbv, status: u.status });
  }
  await logAudit({ companyId, userId, action: 'AMORTIZATION_RUN', entityType: 'intangibleAsset', entityId: entryId ?? '', after: { total } });
  return { total, entryId };
}
