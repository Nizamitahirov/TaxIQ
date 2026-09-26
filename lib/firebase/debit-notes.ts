'use client';

/** Debit-not (alış qaytarması: alıcıdan satıcıya) — sənəd №9. Kreditor fakturanın əks-yazısı. */
import { listByCompanySorted, createDoc, updateDocById } from './firestore';
import { listAccounts, postJournalEntry } from './accounting';
import { resolvePostingRule, codeFor } from './posting-rules';
import { logAudit } from './audit';
import type { DebitNote, PurchaseBill } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

export const listDebitNotes = (companyId: string) =>
  listByCompanySorted<DebitNote>('debitNotes', companyId, 'issueDate', 'desc');

async function nextDnNumber(companyId: string): Promise<string> {
  const all = await listDebitNotes(companyId);
  return `DN-${String(all.length + 1).padStart(4, '0')}`;
}

/** Kreditor fakturanın artıq debit-notlanmış cəm məbləği. */
export async function debitedTotal(companyId: string, billId: string): Promise<number> {
  const all = await listDebitNotes(companyId);
  return round2(all.filter((d) => d.billId === billId).reduce((s, d) => s + (d.grandTotal || 0), 0));
}

/**
 * Kreditor fakturanı debit-notla geri qaytarır: əks-yazı Dt 531 / Kt 205 (+Kt 226).
 * `amount` verilməzsə tam qalıq qaytarılır; verilərsə həmin məbləğ nisbətdə (qismən).
 */
export async function createDebitNote(input: {
  bill: PurchaseBill; amount?: number | null; reason?: string | null; baseCurrency: string; actorUid: string;
}): Promise<string> {
  const { bill, actorUid, baseCurrency } = input;
  const grand = round2(bill.grandTotal);
  const already = await debitedTotal(bill.companyId, bill.id);
  const remaining = round2(grand - already);
  if (remaining <= 0.0001) throw new Error('Bu faktura artıq tam qaytarılıb');

  const amount = input.amount != null ? round2(input.amount) : remaining;
  if (amount <= 0) throw new Error('Məbləğ müsbət olmalıdır');
  if (amount > remaining + 0.0001) throw new Error(`Maksimum qaytarıla bilən məbləğ: ${remaining}`);

  const ratio = grand > 0 ? amount / grand : 1;
  const net = round2(bill.subtotal * ratio);
  const vatPortion = round2((bill.vatTotal || 0) * ratio);
  const dnNumber = await nextDnNumber(bill.companyId);
  const issueDate = new Date().toISOString().slice(0, 10);
  const isFull = amount >= remaining - 0.0001;

  let journalEntryId: string | null = null;
  if (bill.journalEntryId && bill.status !== 'draft') {
    const accounts = await listAccounts(bill.companyId);
    const find = (c: string) => accounts.find((a) => a.accountCode === c);
    const rule = await resolvePostingRule(bill.companyId, 'purchase_bill_approved');
    const goods = find(codeFor(rule, 'inventory', '205')), vat = find(codeFor(rule, 'vatInput', '226')), payable = find(codeFor(rule, 'payable', '531'));
    if (goods && payable) {
      const lines = [
        { accountId: payable.id, accountCode: payable.accountCode, accountName: payable.accountName.az, debit: amount, credit: 0 },
        { accountId: goods.id, accountCode: goods.accountCode, accountName: goods.accountName.az, debit: 0, credit: net },
      ];
      if (vatPortion > 0 && vat) lines.splice(1, 0, { accountId: vat.id, accountCode: vat.accountCode, accountName: vat.accountName.az, debit: 0, credit: vatPortion });
      else if (vatPortion > 0) lines[1].credit = round2(net + vatPortion);
      journalEntryId = await postJournalEntry({
        companyId: bill.companyId, entryDate: issueDate,
        description: `Debit-not ${dnNumber} — kreditor faktura ${bill.billNumber} qaytarması${isFull ? '' : ' (qismən)'}`,
        sourceType: 'purchase_debit_note', sourceDocumentId: bill.id, lines, createdBy: actorUid, baseCurrency,
      });
    }
  }

  const id = await createDoc('debitNotes', {
    companyId: bill.companyId, debitNoteNumber: dnNumber, billId: bill.id, billNumber: bill.billNumber,
    vendorId: bill.vendorId, vendorName: bill.vendorName ?? '', issueDate,
    subtotal: net, vatTotal: vatPortion, grandTotal: amount,
    reason: input.reason ?? null, journalEntryId, createdBy: actorUid,
  });

  await updateDocById('purchaseBills', bill.id, {
    amountDue: round2(Math.max(0, (bill.amountDue ?? 0) - amount)),
    ...(isFull ? { status: 'cancelled', debitNoteId: id } : {}),
  });
  await logAudit({ companyId: bill.companyId, userId: actorUid, action: 'DEBIT_NOTE_CREATED', entityType: 'debitNote', entityId: id, after: { debitNoteNumber: dnNumber, bill: bill.billNumber, amount, partial: !isFull } });
  return id;
}
