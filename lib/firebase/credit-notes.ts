'use client';

/** Kredit-not (satış qaytarması) — fakturanın tam əks-yazısı (06). */
import { listByCompanySorted, createDoc, updateDocById } from './firestore';
import { listAccounts, postJournalEntry } from './accounting';
import { resolvePostingRule, codeFor } from './posting-rules';
import { logAudit } from './audit';
import type { CreditNote, Invoice } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

export const listCreditNotes = (companyId: string) =>
  listByCompanySorted<CreditNote>('creditNotes', companyId, 'issueDate', 'desc');

async function nextCnNumber(companyId: string): Promise<string> {
  const all = await listCreditNotes(companyId);
  return `KN-${String(all.length + 1).padStart(4, '0')}`;
}

/** Fakturanın artıq kredit-notlanmış cəm məbləği (qismən qaytarmaların izlənməsi üçün). */
export async function creditedTotal(companyId: string, invoiceId: string): Promise<number> {
  const all = await listCreditNotes(companyId);
  return round2(all.filter((c) => c.invoiceId === invoiceId).reduce((s, c) => s + (c.grandTotal || 0), 0));
}

/**
 * Fakturanı kredit-notla geri qaytarır: əks-yazı Dt 601 (+Dt 521) / Kt 211.
 * `amount` verilməzsə tam qalıq qaytarılır; verilərsə həmin məbləğ nisbətdə qaytarılır (qismən).
 */
export async function createCreditNote(input: {
  invoice: Invoice; amount?: number | null; reason?: string | null; baseCurrency: string; actorUid: string;
}): Promise<string> {
  const { invoice: inv, actorUid, baseCurrency } = input;
  const grand = round2(inv.grandTotal);
  const already = await creditedTotal(inv.companyId, inv.id);
  const remaining = round2(grand - already);
  if (remaining <= 0.0001) throw new Error('Bu faktura artıq tam qaytarılıb');

  const amount = input.amount != null ? round2(input.amount) : remaining;
  if (amount <= 0) throw new Error('Məbləğ müsbət olmalıdır');
  if (amount > remaining + 0.0001) throw new Error(`Maksimum qaytarıla bilən məbləğ: ${remaining}`);

  const ratio = grand > 0 ? amount / grand : 1;
  const fullNet = round2(inv.subtotal - (inv.discountTotal || 0));
  const net = round2(fullNet * ratio);
  const vatPortion = round2((inv.vatTotal || 0) * ratio);
  const cnNumber = await nextCnNumber(inv.companyId);
  const issueDate = new Date().toISOString().slice(0, 10);
  const isFull = amount >= remaining - 0.0001;

  // Əks-yazı (yalnız rəsmiləşmiş fakturalar üçün)
  let journalEntryId: string | null = null;
  if (inv.journalEntryId && inv.status !== 'draft') {
    const accounts = await listAccounts(inv.companyId);
    const find = (code: string) => accounts.find((a) => a.accountCode === code);
    const rule = await resolvePostingRule(inv.companyId, 'invoice_sent');
    const ar = find(codeFor(rule, 'receivable', '211')), sales = find(codeFor(rule, 'revenue', '601')), vat = find(codeFor(rule, 'vat', '521'));
    if (ar && sales) {
      const dep = inv.departmentId ?? null;
      const lines = [
        { accountId: sales.id, accountCode: sales.accountCode, accountName: sales.accountName.az, debit: net, credit: 0, departmentId: dep },
        { accountId: ar.id, accountCode: ar.accountCode, accountName: ar.accountName.az, debit: 0, credit: amount, departmentId: dep },
      ];
      if (vatPortion > 0 && vat) lines.splice(1, 0, { accountId: vat.id, accountCode: vat.accountCode, accountName: vat.accountName.az, debit: vatPortion, credit: 0, departmentId: dep });
      else if (vatPortion > 0) lines[0].debit = round2(net + vatPortion);
      journalEntryId = await postJournalEntry({
        companyId: inv.companyId, entryDate: issueDate,
        description: `Kredit-not ${cnNumber} — faktura ${inv.invoiceNumber} qaytarması${isFull ? '' : ' (qismən)'}`,
        sourceType: 'sales_credit_note', sourceDocumentId: inv.id, lines, createdBy: actorUid, baseCurrency,
      });
    }
  }

  const id = await createDoc('creditNotes', {
    companyId: inv.companyId, creditNoteNumber: cnNumber, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber,
    customerId: inv.customerId, customerName: inv.customerName ?? '', issueDate,
    subtotal: net, vatTotal: vatPortion, grandTotal: amount,
    reason: input.reason ?? null, journalEntryId, createdBy: actorUid,
  });

  // Fakturanın qalıq borcunu azalt; tam qaytarıldıqda «ləğv edilmiş» işarələ
  await updateDocById('invoices', inv.id, {
    amountDue: round2(Math.max(0, (inv.amountDue ?? 0) - amount)),
    ...(isFull ? { status: 'cancelled', creditNoteId: id } : {}),
  });

  await logAudit({ companyId: inv.companyId, userId: actorUid, action: 'CREDIT_NOTE_CREATED', entityType: 'creditNote', entityId: id, after: { creditNoteNumber: cnNumber, invoice: inv.invoiceNumber, amount, partial: !isFull } });
  return id;
}
