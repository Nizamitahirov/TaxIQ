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

/** Kreditor fakturanı tam debit-notla geri qaytarır: əks-yazı Dt 531 / Kt 205 (+Kt 226). */
export async function createDebitNote(input: {
  bill: PurchaseBill; reason?: string | null; baseCurrency: string; actorUid: string;
}): Promise<string> {
  const { bill, actorUid, baseCurrency } = input;
  const net = round2(bill.subtotal);
  const dnNumber = await nextDnNumber(bill.companyId);
  const issueDate = new Date().toISOString().slice(0, 10);

  let journalEntryId: string | null = null;
  if (bill.journalEntryId && bill.status !== 'draft') {
    const accounts = await listAccounts(bill.companyId);
    const find = (c: string) => accounts.find((a) => a.accountCode === c);
    const rule = await resolvePostingRule(bill.companyId, 'purchase_bill_approved');
    const goods = find(codeFor(rule, 'inventory', '205')), vat = find(codeFor(rule, 'vatInput', '226')), payable = find(codeFor(rule, 'payable', '531'));
    if (goods && payable) {
      const lines = [
        { accountId: payable.id, accountCode: payable.accountCode, accountName: payable.accountName.az, debit: bill.grandTotal, credit: 0 },
        { accountId: goods.id, accountCode: goods.accountCode, accountName: goods.accountName.az, debit: 0, credit: net },
      ];
      if (bill.vatTotal > 0 && vat) lines.splice(1, 0, { accountId: vat.id, accountCode: vat.accountCode, accountName: vat.accountName.az, debit: 0, credit: bill.vatTotal });
      else if (bill.vatTotal > 0) lines[1].credit = round2(net + bill.vatTotal);
      journalEntryId = await postJournalEntry({
        companyId: bill.companyId, entryDate: issueDate,
        description: `Debit-not ${dnNumber} — kreditor faktura ${bill.billNumber} qaytarması`,
        sourceType: 'purchase_debit_note', sourceDocumentId: bill.id, lines, createdBy: actorUid, baseCurrency,
      });
    }
  }

  const id = await createDoc('debitNotes', {
    companyId: bill.companyId, debitNoteNumber: dnNumber, billId: bill.id, billNumber: bill.billNumber,
    vendorId: bill.vendorId, vendorName: bill.vendorName ?? '', issueDate,
    subtotal: net, vatTotal: round2(bill.vatTotal || 0), grandTotal: round2(bill.grandTotal),
    reason: input.reason ?? null, journalEntryId, createdBy: actorUid,
  });

  await updateDocById('purchaseBills', bill.id, { amountDue: 0, status: 'cancelled', debitNoteId: id });
  await logAudit({ companyId: bill.companyId, userId: actorUid, action: 'DEBIT_NOTE_CREATED', entityType: 'debitNote', entityId: id, after: { debitNoteNumber: dnNumber, bill: bill.billNumber, amount: bill.grandTotal } });
  return id;
}
