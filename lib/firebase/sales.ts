import {
  runTransaction, doc, collection, serverTimestamp, where, 
} from 'firebase/firestore';
import { getDb } from './config';
import { listByCompany, listByCompanySorted, getDocById, createDoc, updateDocById, deleteDocById } from './firestore';
import { fireWorkflows } from '@/lib/workflow/engine';
import { logAudit } from './audit';
import { listAccounts, postJournalEntry } from './accounting';
import { resolvePostingRule, codeFor } from './posting-rules';
import type {
  Customer, CustomerGroup, DocLineItem, Invoice, SalesQuote, SalesOrder,
  DocumentTemplate, RecurringInvoiceTemplate,
} from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Məbləğ hesablanması ──────────────────────────────────────
export interface DocTotals { subtotal: number; discountTotal: number; vatTotal: number; grandTotal: number; lines: DocLineItem[] }

export function computeTotals(raw: Omit<DocLineItem, 'lineTotal'>[]): DocTotals {
  let subtotal = 0, discountTotal = 0, vatTotal = 0;
  const lines: DocLineItem[] = raw.map((l) => {
    const gross = round2(l.quantity * l.unitPrice);
    const discount = round2(gross * (l.discountPercent || 0) / 100);
    const net = round2(gross - discount);
    const vat = round2(net * (l.vatRate || 0) / 100);
    subtotal += gross; discountTotal += discount; vatTotal += vat;
    return { ...l, lineTotal: net };
  });
  return {
    subtotal: round2(subtotal), discountTotal: round2(discountTotal), vatTotal: round2(vatTotal),
    grandTotal: round2(subtotal - discountTotal + vatTotal), lines,
  };
}

// ── Müştərilər ───────────────────────────────────────────────
export async function listCustomers(companyId: string): Promise<Customer[]> {
  return listByCompany<Customer>('customers', companyId);
}
export async function createCustomer(data: Omit<Customer, 'id'>): Promise<string> {
  return createDoc('customers', data as Record<string, unknown>);
}
export async function updateCustomer(id: string, data: Partial<Customer>): Promise<void> {
  return updateDocById('customers', id, data as Record<string, unknown>);
}
export async function listCustomerGroups(companyId: string): Promise<CustomerGroup[]> {
  return listByCompany<CustomerGroup>('customerGroups', companyId);
}

// ── Faktura nömrələməsi (boşluqsuz ardıcıl, 06 §3.4) ──────────
async function nextInvoiceNumber(companyId: string): Promise<string> {
  const db = getDb();
  const companyRef = doc(db, 'companies', companyId);
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(companyRef);
    const cur = (snap.data()?.invoiceSequence as number) ?? 0;
    const next = cur + 1;
    tx.update(companyRef, { invoiceSequence: next });
    return next;
  });
  const year = new Date().getFullYear();
  return `INV-${year}-${String(seq).padStart(5, '0')}`;
}

// ── Fakturalar ───────────────────────────────────────────────
export async function listInvoices(companyId: string): Promise<Invoice[]> {
  return listByCompanySorted<Invoice>('invoices', companyId, 'issueDate', 'desc');
}

export interface CreateInvoiceInput {
  companyId: string;
  customerId: string;
  customerName: string;
  issueDate: string;
  paymentTermDays: number;
  currency: string;
  lineItems: Omit<DocLineItem, 'lineTotal'>[];
  departmentId?: string | null;
  notes?: string | null;
  createdBy: string;
}

export async function createInvoice(input: CreateInvoiceInput): Promise<string> {
  const totals = computeTotals(input.lineItems);
  const invoiceNumber = await nextInvoiceNumber(input.companyId);
  const due = new Date(input.issueDate);
  due.setDate(due.getDate() + (input.paymentTermDays || 0));
  const docData = {
    companyId: input.companyId, invoiceNumber, customerId: input.customerId, customerName: input.customerName,
    sourceOrderId: null, issueDate: input.issueDate, dueDate: due.toISOString().slice(0, 10),
    lineItems: totals.lines, subtotal: totals.subtotal, discountTotal: totals.discountTotal,
    vatTotal: totals.vatTotal, grandTotal: totals.grandTotal, currency: input.currency,
    exchangeRateToBaseCurrency: 1, amountPaid: 0, amountDue: totals.grandTotal,
    status: 'draft', departmentId: input.departmentId ?? null, warehouseId: null,
    journalEntryId: null, notes: input.notes ?? null, createdBy: input.createdBy,
  };
  const id = await createDoc('invoices', docData);
  // Faktura təsdiqi workflow (on_create) — 06 / 04 §7.2
  await fireWorkflows(input.companyId, 'invoices', 'on_create', { id, ...docData }, id, input.createdBy);
  return id;
}

/**
 * Fakturanı rəsmiləşdir (sent) — 06 §3.3. Satış jurnal yazısı avtomatik yaradılır:
 *   Dt 211 (Debitor) grandTotal / Kt 601 (Satış) net / Kt 521 (ƏDV) vatTotal
 * Qeyd: anbar hərəkəti (Fayl 5) və COGS yazısı Modul 5 qoşulduqda əlavə olunacaq.
 */
export async function postInvoice(invoice: Invoice, baseCurrency: string, actorUid: string): Promise<void> {
  if (invoice.status !== 'draft') throw new Error('Yalnız draft faktura rəsmiləşdirilə bilər');
  const accounts = await listAccounts(invoice.companyId);
  const find = (code: string) => accounts.find((a) => a.accountCode === code);
  const rule = await resolvePostingRule(invoice.companyId, 'invoice_sent');
  const ar = find(codeFor(rule, 'receivable', '211')), sales = find(codeFor(rule, 'revenue', '601')), vat = find(codeFor(rule, 'vat', '521'));
  if (!ar || !sales) throw new Error('Hesablar Planı qurulmayıb (211/601 hesabları tapılmadı). Əvvəlcə Mühasibat → Hesablar Planını qurun.');

  const net = round2(invoice.subtotal - invoice.discountTotal);
  const dep = invoice.departmentId ?? null;
  const lines = [
    { accountId: ar.id, accountCode: ar.accountCode, accountName: ar.accountName.az, debit: invoice.grandTotal, credit: 0, departmentId: dep },
    { accountId: sales.id, accountCode: sales.accountCode, accountName: sales.accountName.az, debit: 0, credit: net, departmentId: dep },
  ];
  if (invoice.vatTotal > 0 && vat) {
    lines.push({ accountId: vat.id, accountCode: vat.accountCode, accountName: vat.accountName.az, debit: 0, credit: invoice.vatTotal, departmentId: dep });
  } else if (invoice.vatTotal > 0) {
    // ƏDV hesabı yoxdursa bütün məbləği satışa yaz (balans pozulmasın)
    lines[1].credit = round2(net + invoice.vatTotal);
  }

  const journalEntryId = await postJournalEntry({
    companyId: invoice.companyId, entryDate: invoice.issueDate,
    description: `Satış fakturası ${invoice.invoiceNumber} — ${invoice.customerName ?? ''}`,
    sourceType: 'sales_invoice', sourceDocumentId: invoice.id,
    lines, createdBy: actorUid, baseCurrency,
  });

  await updateDocById('invoices', invoice.id, { status: 'sent', journalEntryId });
  await logAudit({ companyId: invoice.companyId, userId: actorUid, action: 'INVOICE_SENT', entityType: 'invoice', entityId: invoice.id, after: { invoiceNumber: invoice.invoiceNumber, journalEntryId } });
}

export async function cancelInvoice(invoice: Invoice, actorUid: string): Promise<void> {
  await updateDocById('invoices', invoice.id, { status: 'cancelled' });
  await logAudit({ companyId: invoice.companyId, userId: actorUid, action: 'INVOICE_CANCELLED', entityType: 'invoice', entityId: invoice.id });
  // Qeyd: rəsmiləşmiş fakturanın jurnal yazısı əks-yazı ilə ləğv edilməlidir (Mühasibat → əks yazı).
}

// ── AR Aging (06 §8) ─────────────────────────────────────────
export interface AgingRow { customerId: string; customerName: string; b0_30: number; b31_60: number; b61_90: number; b90: number; total: number }

export function computeAging(invoices: Invoice[]): { rows: AgingRow[]; totals: Omit<AgingRow, 'customerId' | 'customerName'> } {
  const today = new Date();
  const map = new Map<string, AgingRow>();
  for (const inv of invoices) {
    if (!['sent', 'partially_paid', 'overdue'].includes(inv.status)) continue;
    const due = inv.amountDue ?? 0;
    if (due <= 0) continue;
    const key = inv.customerId;
    const row = map.get(key) ?? { customerId: key, customerName: inv.customerName ?? key, b0_30: 0, b31_60: 0, b61_90: 0, b90: 0, total: 0 };
    const days = Math.floor((today.getTime() - new Date(inv.dueDate).getTime()) / 86_400_000);
    if (days <= 30) row.b0_30 += due;
    else if (days <= 60) row.b31_60 += due;
    else if (days <= 90) row.b61_90 += due;
    else row.b90 += due;
    row.total += due;
    map.set(key, row);
  }
  const rows = [...map.values()].map((r) => ({
    ...r, b0_30: round2(r.b0_30), b31_60: round2(r.b31_60), b61_90: round2(r.b61_90), b90: round2(r.b90), total: round2(r.total),
  })).sort((a, b) => b.total - a.total);
  const totals = rows.reduce((t, r) => ({
    b0_30: round2(t.b0_30 + r.b0_30), b31_60: round2(t.b31_60 + r.b31_60),
    b61_90: round2(t.b61_90 + r.b61_90), b90: round2(t.b90 + r.b90), total: round2(t.total + r.total),
  }), { b0_30: 0, b31_60: 0, b61_90: 0, b90: 0, total: 0 });
  return { rows, totals };
}

// ── Kommersiya təklifi / Sifariş (06 §2) ─────────────────────
async function nextSeq(companyId: string, field: string, prefix: string): Promise<string> {
  const db = getDb();
  const companyRef = doc(db, 'companies', companyId);
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(companyRef);
    const cur = (snap.data()?.[field] as number) ?? 0;
    const next = cur + 1;
    tx.update(companyRef, { [field]: next });
    return next;
  });
  return `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;
}

export async function listQuotes(companyId: string): Promise<SalesQuote[]> {
  return listByCompanySorted<SalesQuote>('salesQuotes', companyId, 'issueDate', 'desc');
}
export async function listOrders(companyId: string): Promise<SalesOrder[]> {
  return listByCompanySorted<SalesOrder>('salesOrders', companyId, 'createdAt', 'desc');
}

export async function createQuote(input: { companyId: string; customerId: string; customerName: string; issueDate: string; validUntil?: string; currency: string; lineItems: Omit<DocLineItem, 'lineTotal'>[]; createdBy: string }): Promise<string> {
  const t = computeTotals(input.lineItems);
  const quoteNumber = await nextSeq(input.companyId, 'quoteSequence', 'Q');
  return createDoc('salesQuotes', {
    companyId: input.companyId, quoteNumber, customerId: input.customerId, customerName: input.customerName,
    issueDate: input.issueDate, validUntil: input.validUntil ?? null, lineItems: t.lines,
    subtotal: t.subtotal, discountTotal: t.discountTotal, vatTotal: t.vatTotal, grandTotal: t.grandTotal,
    currency: input.currency, status: 'draft', createdBy: input.createdBy,
  });
}

/** Təklif → Sifariş (06 §2.1) */
export async function convertQuoteToOrder(quote: SalesQuote, actorUid: string): Promise<string> {
  const orderNumber = await nextSeq(quote.companyId, 'orderSequence', 'SO');
  const orderId = await createDoc('salesOrders', {
    companyId: quote.companyId, orderNumber, customerId: quote.customerId, customerName: quote.customerName,
    sourceQuoteId: quote.id, lineItems: quote.lineItems, subtotal: quote.subtotal, discountTotal: quote.discountTotal,
    vatTotal: quote.vatTotal, grandTotal: quote.grandTotal, currency: quote.currency,
    fulfillmentWarehouseId: null, status: 'confirmed', invoiceId: null, createdBy: actorUid,
  });
  await updateDocById('salesQuotes', quote.id, { status: 'converted_to_order' });
  return orderId;
}

/** Sifariş → Faktura (06 §2.2) */
export async function convertOrderToInvoice(order: SalesOrder, customer: Customer | null, actorUid: string): Promise<string> {
  const invoiceId = await createInvoice({
    companyId: order.companyId, customerId: order.customerId, customerName: order.customerName ?? '',
    issueDate: new Date().toISOString().slice(0, 10), paymentTermDays: customer?.paymentTermDays ?? 0,
    currency: order.currency,
    lineItems: order.lineItems.map((l) => ({ goodId: l.goodId ?? null, description: l.description, quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice, discountPercent: l.discountPercent, vatRate: l.vatRate })),
    createdBy: actorUid,
  });
  await updateDocById('salesOrders', order.id, { status: 'invoiced', invoiceId });
  await updateDocById('invoices', invoiceId, { sourceOrderId: order.id });
  return invoiceId;
}

export async function getCustomer(id: string): Promise<Customer | null> {
  return getDocById<Customer>('customers', id);
}

// ── e-Qaimə (STS) statusu (06 §5) ───────────────────────────
export async function markEInvoiceSubmitted(invoice: Invoice, stsRef: string, actorUid: string): Promise<void> {
  await updateDocById('invoices', invoice.id, {
    eInvoice: { submittedToSTS: true, stsReferenceNumber: stsRef, submittedAt: new Date().toISOString().slice(0, 10) },
  });
  await logAudit({ companyId: invoice.companyId, userId: actorUid, action: 'EINVOICE_SUBMITTED', entityType: 'invoice', entityId: invoice.id, after: { stsRef } });
}

/** Vaxtı keçmiş fakturaların statusunu yenilə (06 §3.2, Cloud Scheduler alternativi) */
export async function refreshOverdue(companyId: string): Promise<number> {
  const invoices = await listByCompany<Invoice>('invoices', companyId);
  const today = new Date().toISOString().slice(0, 10);
  let n = 0;
  for (const inv of invoices) {
    if (['sent', 'partially_paid'].includes(inv.status) && inv.dueDate < today && (inv.amountDue ?? 0) > 0) {
      await updateDocById('invoices', inv.id, { status: 'overdue' });
      n++;
    }
  }
  return n;
}

// ── Sənəd şablonları (06 §6) ────────────────────────────────
export const listDocumentTemplates = (companyId: string) => listByCompany<DocumentTemplate>('documentTemplates', companyId);
export const createDocumentTemplate = (d: Omit<DocumentTemplate, 'id'>) => createDoc('documentTemplates', d as Record<string, unknown>);
export const updateDocumentTemplate = (id: string, d: Partial<DocumentTemplate>) => updateDocById('documentTemplates', id, d as Record<string, unknown>);
export const deleteDocumentTemplate = (id: string) => deleteDocById('documentTemplates', id);
/** Bir tip üçün yalnız 1 defolt — digərlərini söndür */
export async function setDefaultTemplate(companyId: string, tpl: DocumentTemplate): Promise<void> {
  const all = await listByCompany<DocumentTemplate>('documentTemplates', companyId);
  for (const t of all) if (t.type === tpl.type && t.isDefault && t.id !== tpl.id) await updateDocById('documentTemplates', t.id, { isDefault: false });
  await updateDocById('documentTemplates', tpl.id, { isDefault: true });
}

// ── Təkrarlanan fakturalar (06 §4) ──────────────────────────
export const listRecurringTemplates = (companyId: string) => listByCompanySorted<RecurringInvoiceTemplate>('recurringInvoiceTemplates', companyId, 'createdAt', 'desc');
export const createRecurringTemplate = (d: Omit<RecurringInvoiceTemplate, 'id'>) => createDoc('recurringInvoiceTemplates', d as Record<string, unknown>);
export const updateRecurringTemplate = (id: string, d: Partial<RecurringInvoiceTemplate>) => updateDocById('recurringInvoiceTemplates', id, d as Record<string, unknown>);
export const deleteRecurringTemplate = (id: string) => deleteDocById('recurringInvoiceTemplates', id);

function advanceDate(iso: string, freq: RecurringInvoiceTemplate['frequency']): string {
  const d = new Date(iso);
  if (freq === 'monthly') d.setMonth(d.getMonth() + 1);
  else if (freq === 'quarterly') d.setMonth(d.getMonth() + 3);
  else d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

/** Vaxtı çatan təkrarlanan şablonlardan yeni fakturalar yaradır (client-side scheduler alternativi) */
export async function generateDueRecurringInvoices(companyId: string, actorUid: string): Promise<number> {
  const templates = await listRecurringTemplates(companyId);
  const today = new Date().toISOString().slice(0, 10);
  let created = 0;
  for (const t of templates) {
    if (!t.isActive) continue;
    if (t.endDate && t.nextRunDate > t.endDate) continue;
    // Vaxtı çatan bütün dövrləri yarat (buraxılmış aylar da)
    let next = t.nextRunDate;
    let lastId = t.lastGeneratedInvoiceId ?? null;
    while (next <= today && (!t.endDate || next <= t.endDate)) {
      const customer = await getCustomer(t.customerId);
      lastId = await createInvoice({
        companyId, customerId: t.customerId, customerName: t.customerName ?? customer?.name ?? '',
        issueDate: next, paymentTermDays: customer?.paymentTermDays ?? 0, currency: (customer?.defaultCurrency ?? 'AZN'),
        lineItems: t.lineItems.map((l) => ({ goodId: l.goodId ?? null, description: l.description, quantity: l.quantity, unit: l.unit, unitPrice: l.unitPrice, discountPercent: l.discountPercent, vatRate: l.vatRate })),
        createdBy: actorUid,
      });
      created++;
      next = advanceDate(next, t.frequency);
    }
    if (created > 0 || next !== t.nextRunDate) {
      await updateRecurringTemplate(t.id, { nextRunDate: next, lastGeneratedInvoiceId: lastId, lastGeneratedAt: today });
    }
  }
  return created;
}

export { where };
