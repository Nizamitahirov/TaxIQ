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

/** Fakturanı tam kredit-notla geri qaytarır: əks-yazı Dt 601+Dt 521 / Kt 211. */
export async function createCreditNote(input: {
  invoice: Invoice; reason?: string | null; baseCurrency: string; actorUid: string;
}): Promise<string> {
  const { invoice: inv, actorUid, baseCurrency } = input;
  const net = round2(inv.subtotal - (inv.discountTotal || 0));
  const cnNumber = await nextCnNumber(inv.companyId);
  const issueDate = new Date().toISOString().slice(0, 10);

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
        { accountId: ar.id, accountCode: ar.accountCode, accountName: ar.accountName.az, debit: 0, credit: inv.grandTotal, departmentId: dep },
      ];
      if (inv.vatTotal > 0 && vat) lines.splice(1, 0, { accountId: vat.id, accountCode: vat.accountCode, accountName: vat.accountName.az, debit: inv.vatTotal, credit: 0, departmentId: dep });
      else if (inv.vatTotal > 0) lines[0].debit = round2(net + inv.vatTotal);
      journalEntryId = await postJournalEntry({
        companyId: inv.companyId, entryDate: issueDate,
        description: `Kredit-not ${cnNumber} — faktura ${inv.invoiceNumber} qaytarması`,
        sourceType: 'sales_credit_note', sourceDocumentId: inv.id, lines, createdBy: actorUid, baseCurrency,
      });
    }
  }

  const id = await createDoc('creditNotes', {
    companyId: inv.companyId, creditNoteNumber: cnNumber, invoiceId: inv.id, invoiceNumber: inv.invoiceNumber,
    customerId: inv.customerId, customerName: inv.customerName ?? '', issueDate,
    subtotal: net, vatTotal: round2(inv.vatTotal || 0), grandTotal: round2(inv.grandTotal),
    reason: input.reason ?? null, journalEntryId, createdBy: actorUid,
  });

  // Fakturanın qalıq borcunu azalt və qaytarılmış kimi işarələ
  await updateDocById('invoices', inv.id, {
    amountDue: 0,
    status: 'cancelled',
    creditNoteId: id,
  });

  await logAudit({ companyId: inv.companyId, userId: actorUid, action: 'CREDIT_NOTE_CREATED', entityType: 'creditNote', entityId: id, after: { creditNoteNumber: cnNumber, invoice: inv.invoiceNumber, amount: inv.grandTotal } });
  return id;
}
