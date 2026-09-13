import {
  writeBatch, doc, collection, serverTimestamp, getDoc, setDoc, where, orderBy,
} from 'firebase/firestore';
import { getDb } from './config';
import { listDocs, listByCompany, createDoc, getDocById, updateDocById } from './firestore';
import { logAudit } from './audit';
import { buildCoaTemplate } from '@/lib/accounting/coa-template';
import type {
  ChartAccount, JournalEntry, JournalLine, AccountingPeriod, FixedAsset,
} from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Hesablar Planı ──────────────────────────────────────────
export async function listAccounts(companyId: string): Promise<ChartAccount[]> {
  const rows = await listByCompany<ChartAccount>('chartOfAccounts', companyId);
  return rows.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
}

/** Yeni şirkətə rəsmi Hesablar Planını köçürür (08 §1.4). İdempotent. */
export async function initializeChartOfAccounts(companyId: string, createdBy: string): Promise<number> {
  const existing = await listByCompany<ChartAccount>('chartOfAccounts', companyId, []);
  if (existing.length > 0) return 0;
  const template = buildCoaTemplate();
  const db = getDb();
  // Firestore batch limiti 500 — şablon kiçikdir, tək batch kifayətdir
  const batch = writeBatch(db);
  for (const t of template) {
    const ref = doc(collection(db, 'chartOfAccounts'));
    batch.set(ref, {
      companyId, accountCode: t.accountCode, accountName: t.accountName,
      accountClass: t.accountClass, accountGroup: t.accountGroup, accountType: t.accountType,
      normalBalance: t.normalBalance, isPostable: t.isPostable, isSubAccount: false,
      parentAccountId: null, currency: null, isActive: true, isSystemAccount: true,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    });
  }
  await batch.commit();
  await logAudit({ companyId, userId: createdBy, action: 'COA_INITIALIZED', entityType: 'chartOfAccounts', entityId: companyId, after: { count: template.length } });
  return template.length;
}

export async function createSubAccount(input: {
  companyId: string; parent: ChartAccount; code: string; nameAz: string; nameEn: string; createdBy: string;
}): Promise<string> {
  return createDoc('chartOfAccounts', {
    companyId: input.companyId,
    accountCode: input.code,
    accountName: { az: input.nameAz, en: input.nameEn || input.nameAz },
    accountClass: input.parent.accountClass,
    accountGroup: input.parent.accountGroup,
    accountType: input.parent.accountType,
    normalBalance: input.parent.normalBalance,
    isPostable: true, isSubAccount: true,
    parentAccountId: input.parent.id, currency: null,
    isActive: true, isSystemAccount: false,
  });
}

// ── Dövrlər (Periods) ───────────────────────────────────────
function periodId(companyId: string, year: number, month: number): string {
  return `${companyId}_${year}_${String(month).padStart(2, '0')}`;
}

export async function listPeriods(companyId: string): Promise<AccountingPeriod[]> {
  const rows = await listByCompany<AccountingPeriod>('accountingPeriods', companyId);
  return rows.sort((a, b) => (b.fiscalYear - a.fiscalYear) || (b.periodNumber - a.periodNumber));
}

/** Verilmiş tarix üçün dövrü qaytarır/yaradır (açıq status ilə) */
export async function ensurePeriod(companyId: string, dateStr: string): Promise<AccountingPeriod> {
  const [y, m] = dateStr.split('-').map(Number);
  const id = periodId(companyId, y, m);
  const existing = await getDocById<AccountingPeriod>('accountingPeriods', id);
  if (existing) return existing;
  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const end = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;
  const data: Omit<AccountingPeriod, 'id'> = {
    companyId, fiscalYear: y, periodNumber: m, periodStart: start, periodEnd: end, status: 'open',
  };
  await setDoc(doc(getDb(), 'accountingPeriods', id), { ...data, createdAt: serverTimestamp() });
  return { id, ...data };
}

export async function closePeriod(id: string, userId: string): Promise<void> {
  await updateDocById('accountingPeriods', id, { status: 'closed', closedBy: userId, closedAt: serverTimestamp() });
  await logAudit({ userId, action: 'PERIOD_CLOSED', entityType: 'accountingPeriod', entityId: id });
}

/** Dövrü yenidən aç — icazə tələb edir, yüksək prioritetli audit (08 §4.2 addım 6) */
export async function reopenPeriod(id: string, userId: string, reason: string): Promise<void> {
  await updateDocById('accountingPeriods', id, { status: 'open', reopenReason: reason });
  await logAudit({ userId, action: 'PERIOD_REOPENED', entityType: 'accountingPeriod', entityId: id, after: { reason } });
}

// ── İkili yazılış mühərriki ─────────────────────────────────
export interface PostEntryInput {
  companyId: string;
  entryDate: string;            // "YYYY-MM-DD"
  description: string;
  sourceType?: JournalEntry['sourceType'];
  sourceDocumentId?: string | null;
  lines: JournalLine[];
  createdBy: string;
  baseCurrency?: string;
}

/**
 * postJournalEntry — 08 §2.2. Balans və açıq dövr yoxlaması burada məcburidir.
 * ⚠️ İstehsalat sərtləşdirməsi: bu yoxlama Cloud Function-da (server) aparılmalıdır;
 * hazırkı versiyada client-side enforce olunur (Firebase Functions deploy tələb etmədən).
 */
export async function postJournalEntry(input: PostEntryInput): Promise<string> {
  const lines = input.lines.filter((l) => (l.debit || 0) !== 0 || (l.credit || 0) !== 0);
  if (lines.length < 2) throw new Error('Ən azı 2 sətir tələb olunur');

  const totalDebit = round2(lines.reduce((s, l) => s + (l.debit || 0), 0));
  const totalCredit = round2(lines.reduce((s, l) => s + (l.credit || 0), 0));
  if (totalDebit !== totalCredit) {
    throw new Error(`Balanslaşdırılmayıb: fərq ${round2(Math.abs(totalDebit - totalCredit))}`);
  }
  for (const l of lines) {
    if ((l.debit || 0) > 0 && (l.credit || 0) > 0) throw new Error('Bir sətirdə həm debet, həm kredit ola bilməz');
  }

  // Dövr açıqdırmı?
  const period = await ensurePeriod(input.companyId, input.entryDate);
  if (period.status === 'closed') throw new Error('Bu dövr bağlıdır — yazı aparıla bilməz (08 §4.2)');

  // Ardıcıl entryNumber
  const count = (await listByCompany<JournalEntry>('journalEntries', input.companyId, [])).length;
  const year = input.entryDate.slice(0, 4);
  const entryNumber = `JE-${year}-${String(count + 1).padStart(5, '0')}`;

  const base = input.baseCurrency ?? 'AZN';
  const normLines = lines.map((l) => ({
    accountId: l.accountId,
    accountCode: l.accountCode ?? '',
    accountName: l.accountName ?? '',
    debit: round2(l.debit || 0),
    credit: round2(l.credit || 0),
    departmentId: l.departmentId ?? null,
    currency: l.currency ?? base,
    amountInBaseCurrency: round2((l.debit || 0) - (l.credit || 0)),
  }));

  return createDoc('journalEntries', {
    companyId: input.companyId,
    entryNumber,
    entryDate: input.entryDate,
    entryDateStr: input.entryDate,
    postingPeriodId: period.id,
    sourceType: input.sourceType ?? 'manual',
    sourceDocumentId: input.sourceDocumentId ?? null,
    description: input.description,
    lines: normLines,
    totalDebit, totalCredit,
    status: 'posted',
    reversalOfEntryId: null,
    createdBy: input.createdBy,
  });
}

export async function listJournalEntries(companyId: string): Promise<JournalEntry[]> {
  const rows = await listByCompany<JournalEntry>('journalEntries', companyId, [orderBy('entryDateStr', 'desc')]);
  return rows;
}

/** Əks-yazı (08 §2.5) — orijinal silinmir, Dt/Kt tərsinə çevrilən yeni yazı */
export async function reverseEntry(entry: JournalEntry, userId: string): Promise<string> {
  if (entry.status === 'reversed') throw new Error('Bu yazı artıq əks edilib');
  const today = new Date().toISOString().slice(0, 10);
  const reversedLines: JournalLine[] = entry.lines.map((l) => ({
    ...l, debit: l.credit, credit: l.debit,
  }));
  const newId = await postJournalEntry({
    companyId: entry.companyId,
    entryDate: today,
    description: `Əks yazı: ${entry.entryNumber} — ${entry.description}`,
    sourceType: entry.sourceType,
    sourceDocumentId: entry.id,
    lines: reversedLines,
    createdBy: userId,
  });
  await updateDocById('journalEntries', entry.id, { status: 'reversed', reversalOfEntryId: newId });
  await logAudit({ companyId: entry.companyId, userId, action: 'JOURNAL_REVERSED', entityType: 'journalEntry', entityId: entry.id, after: { reversalId: newId } });
  return newId;
}

// ── Yoxlama Balansı (Trial Balance) ─────────────────────────
export interface TrialBalanceRow {
  accountId: string; accountCode: string; accountName: string;
  debit: number; credit: number; balance: number; normalBalance: 'debit' | 'credit';
}

export async function computeTrialBalance(companyId: string): Promise<{ rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number }> {
  const [accounts, entries] = await Promise.all([listAccounts(companyId), listJournalEntries(companyId)]);
  const acctMap = new Map(accounts.map((a) => [a.id, a]));
  const agg = new Map<string, { debit: number; credit: number }>();
  for (const e of entries) {
    if (e.status === 'reversed') { /* əks edilmiş də öz əks-yazısı ilə balanslaşır; hər ikisi saxlanılır */ }
    for (const l of e.lines) {
      const cur = agg.get(l.accountId) ?? { debit: 0, credit: 0 };
      cur.debit += l.debit || 0; cur.credit += l.credit || 0;
      agg.set(l.accountId, cur);
    }
  }
  const rows: TrialBalanceRow[] = [];
  let totalDebit = 0, totalCredit = 0;
  for (const [accountId, v] of agg) {
    const a = acctMap.get(accountId);
    if (!a) continue;
    const net = round2(v.debit - v.credit);
    const debit = net > 0 ? net : 0;
    const credit = net < 0 ? -net : 0;
    totalDebit += debit; totalCredit += credit;
    rows.push({
      accountId, accountCode: a.accountCode, accountName: a.accountName.az,
      debit, credit, balance: round2(Math.abs(net)), normalBalance: a.normalBalance,
    });
  }
  rows.sort((x, y) => x.accountCode.localeCompare(y.accountCode));
  return { rows, totalDebit: round2(totalDebit), totalCredit: round2(totalCredit) };
}

// ── Əsas Vəsaitlər (Fixed Assets) ───────────────────────────
export async function listFixedAssets(companyId: string): Promise<FixedAsset[]> {
  return listByCompany<FixedAsset>('fixedAssets', companyId);
}

export async function createFixedAsset(input: Omit<FixedAsset, 'id' | 'accumulatedDepreciation' | 'netBookValue' | 'status'> & { createdBy: string }): Promise<string> {
  const { createdBy, ...asset } = input;
  return createDoc('fixedAssets', {
    ...asset, accumulatedDepreciation: 0, netBookValue: asset.acquisitionCost, status: 'active', createdBy,
  });
}

/** Aylıq amortizasiya məbləği (08 §5.2, IAS 16) */
export function monthlyDepreciation(a: FixedAsset): number {
  if (a.status !== 'active') return 0;
  if (a.depreciationMethod === 'straight_line') {
    return round2(Math.max(0, (a.acquisitionCost - a.residualValue) / a.usefulLifeMonths));
  }
  const rate = (a.reducingBalanceRate ?? 0) / 100;
  return round2(a.netBookValue * (rate / 12));
}

/**
 * Aylıq amortizasiyanı icra edir: konsolidasiya edilmiş jurnal yazısı (Dt 721 / Kt 112)
 * + hər aktivin accumulatedDepreciation/netBookValue yenilənməsi (08 §5.3).
 */
export async function runDepreciation(companyId: string, userId: string, expenseAccountId: string, accumAccountId: string): Promise<{ total: number; entryId: string | null }> {
  const assets = (await listFixedAssets(companyId)).filter((a) => a.status === 'active');
  let total = 0;
  const updates: { id: string; accumulated: number; nbv: number; status: FixedAsset['status'] }[] = [];
  for (const a of assets) {
    let dep = monthlyDepreciation(a);
    const maxDep = round2(a.acquisitionCost - a.residualValue - a.accumulatedDepreciation);
    if (dep > maxDep) dep = maxDep;
    if (dep <= 0) continue;
    const accumulated = round2(a.accumulatedDepreciation + dep);
    const nbv = round2(a.acquisitionCost - accumulated);
    const status: FixedAsset['status'] = nbv <= a.residualValue ? 'fully_depreciated' : 'active';
    updates.push({ id: a.id, accumulated, nbv, status });
    total += dep;
  }
  total = round2(total);
  if (total <= 0) return { total: 0, entryId: null };

  const today = new Date().toISOString().slice(0, 10);
  const entryId = await postJournalEntry({
    companyId, entryDate: today, description: 'Aylıq amortizasiya (konsolidasiya)',
    sourceType: 'depreciation',
    lines: [
      { accountId: expenseAccountId, debit: total, credit: 0 },
      { accountId: accumAccountId, debit: 0, credit: total },
    ],
    createdBy: userId,
  });
  for (const u of updates) {
    await updateDocById('fixedAssets', u.id, { accumulatedDepreciation: u.accumulated, netBookValue: u.nbv, status: u.status });
  }
  return { total, entryId };
}

export { where };
