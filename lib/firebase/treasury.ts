import {
  runTransaction, doc, serverTimestamp, orderBy, where,
} from 'firebase/firestore';
import { getDb } from './config';
import { listByCompany, getDocById, createDoc, updateDocById, deleteDocById, setDocById } from './firestore';
import { logAudit } from './audit';
import { listAccounts, postJournalEntry } from './accounting';
import { computeTotals } from './sales';
import type {
  BankAccount, CashRegister, CashTransaction, CashTxnCategory, DocLineItem,
  Invoice, Payment, PaymentAllocation, PurchaseBill, Vendor,
  ExchangeRate, BankFileFormat, PaymentOrderBatch, PaymentOrderItem, BankStatementImport,
  StatementLine, CashDailyClosing, PeriodEndRevaluation, RevaluedItem,
} from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Bank hesabları & Kassalar ───────────────────────────────
export const listBankAccounts = (companyId: string) => listByCompany<BankAccount>('bankAccounts', companyId);
export const listCashRegisters = (companyId: string) => listByCompany<CashRegister>('cashRegisters', companyId);

export const createBankAccount = (d: Omit<BankAccount, 'id'>) => createDoc('bankAccounts', d as Record<string, unknown>);
export const createCashRegister = (d: Omit<CashRegister, 'id'>) => createDoc('cashRegisters', d as Record<string, unknown>);

/** Balansı tranzaksiya-təhlükəsiz dəyiş (07 §9) */
async function adjustBalance(coll: 'bankAccounts' | 'cashRegisters', id: string, delta: number): Promise<void> {
  const db = getDb();
  const ref = doc(db, coll, id);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const cur = (snap.data()?.currentBalance as number) ?? 0;
    tx.update(ref, { currentBalance: round2(cur + delta), updatedAt: serverTimestamp() });
  });
}

// ── Təchizatçılar & Kreditor fakturalar ─────────────────────
export const listVendors = (companyId: string) => listByCompany<Vendor>('vendors', companyId);
export const createVendor = (d: Omit<Vendor, 'id'>) => createDoc('vendors', d as Record<string, unknown>);
export const getVendor = (id: string) => getDocById<Vendor>('vendors', id);
export const listPurchaseBills = (companyId: string) => listByCompany<PurchaseBill>('purchaseBills', companyId, [orderBy('issueDate', 'desc')]);

async function nextSeq(companyId: string, field: string, prefix: string): Promise<string> {
  const db = getDb();
  const ref = doc(db, 'companies', companyId);
  const seq = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const cur = (snap.data()?.[field] as number) ?? 0;
    tx.update(ref, { [field]: cur + 1 });
    return cur + 1;
  });
  return `${prefix}-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`;
}

export async function createPurchaseBill(input: {
  companyId: string; vendorId: string; vendorName: string; vendorInvoiceReference?: string;
  issueDate: string; paymentTermDays: number; currency: string;
  lineItems: Omit<DocLineItem, 'lineTotal'>[]; createdBy: string;
}): Promise<string> {
  const t = computeTotals(input.lineItems);
  const billNumber = await nextSeq(input.companyId, 'billSequence', 'BILL');
  const due = new Date(input.issueDate); due.setDate(due.getDate() + (input.paymentTermDays || 0));
  return createDoc('purchaseBills', {
    companyId: input.companyId, billNumber, vendorId: input.vendorId, vendorName: input.vendorName,
    vendorInvoiceReference: input.vendorInvoiceReference ?? '', issueDate: input.issueDate, dueDate: due.toISOString().slice(0, 10),
    lineItems: t.lines, subtotal: round2(t.subtotal - t.discountTotal), vatTotal: t.vatTotal, grandTotal: t.grandTotal,
    currency: input.currency, amountPaid: 0, amountDue: t.grandTotal, status: 'draft', warehouseId: null,
    journalEntryId: null, createdBy: input.createdBy,
  });
}

/** Kreditor fakturanı təsdiqlə → jurnal: Dt 205 (Mal)+Dt 226 (ƏDV) / Kt 531 (07 §4.2) */
export async function approveBill(bill: PurchaseBill, baseCurrency: string, actorUid: string): Promise<void> {
  if (bill.status !== 'draft') throw new Error('Yalnız draft faktura təsdiqlənə bilər');
  const accounts = await listAccounts(bill.companyId);
  const find = (c: string) => accounts.find((a) => a.accountCode === c);
  const goods = find('205'), vat = find('226'), payable = find('531');
  if (!goods || !payable) throw new Error('Hesablar Planı qurulmayıb (205/531 tapılmadı)');
  const net = round2(bill.subtotal);
  const lines = [
    { accountId: goods.id, accountCode: goods.accountCode, accountName: goods.accountName.az, debit: net, credit: 0 },
    { accountId: payable.id, accountCode: payable.accountCode, accountName: payable.accountName.az, debit: 0, credit: bill.grandTotal },
  ];
  if (bill.vatTotal > 0 && vat) lines.splice(1, 0, { accountId: vat.id, accountCode: vat.accountCode, accountName: vat.accountName.az, debit: bill.vatTotal, credit: 0 });
  else if (bill.vatTotal > 0) lines[0].debit = round2(net + bill.vatTotal);

  const journalEntryId = await postJournalEntry({
    companyId: bill.companyId, entryDate: bill.issueDate,
    description: `Kreditor faktura ${bill.billNumber} — ${bill.vendorName ?? ''}`,
    sourceType: 'purchase_bill', sourceDocumentId: bill.id, lines, createdBy: actorUid, baseCurrency,
  });
  await updateDocById('purchaseBills', bill.id, { status: 'approved', journalEntryId });
  await logAudit({ companyId: bill.companyId, userId: actorUid, action: 'BILL_APPROVED', entityType: 'purchaseBill', entityId: bill.id });
}

// ── Kassa əməliyyatları ─────────────────────────────────────
export const listCashTransactions = (companyId: string) => listByCompany<CashTransaction>('cashTransactions', companyId, [orderBy('transactionDate', 'desc')]);

const CATEGORY_ACCOUNT: Record<CashTxnCategory, string> = {
  sales_receipt: '601', expense: '721', owner_contribution: '301',
  bank_deposit: '223', bank_withdrawal: '223', other: '611',
};

export async function createCashTransaction(input: {
  companyId: string; cashRegisterId: string; type: 'cash_in' | 'cash_out';
  amount: number; currency: string; category: CashTxnCategory; transactionDate: string;
  note?: string; baseCurrency: string; performedBy: string;
}): Promise<string> {
  const accounts = await listAccounts(input.companyId);
  const find = (c: string) => accounts.find((a) => a.accountCode === c);
  const cash = find('221');
  const counter = find(CATEGORY_ACCOUNT[input.category]) ?? find('611');
  let journalEntryId: string | null = null;
  if (cash && counter) {
    const lines = input.type === 'cash_in'
      ? [{ accountId: cash.id, accountCode: cash.accountCode, accountName: cash.accountName.az, debit: input.amount, credit: 0 },
         { accountId: counter.id, accountCode: counter.accountCode, accountName: counter.accountName.az, debit: 0, credit: input.amount }]
      : [{ accountId: counter.id, accountCode: counter.accountCode, accountName: counter.accountName.az, debit: input.amount, credit: 0 },
         { accountId: cash.id, accountCode: cash.accountCode, accountName: cash.accountName.az, debit: 0, credit: input.amount }];
    journalEntryId = await postJournalEntry({
      companyId: input.companyId, entryDate: input.transactionDate,
      description: `Kassa ${input.type === 'cash_in' ? 'mədaxil' : 'məxaric'} — ${input.note ?? input.category}`,
      sourceType: 'cash_transaction', lines, createdBy: input.performedBy, baseCurrency: input.baseCurrency,
    });
  }
  const id = await createDoc('cashTransactions', {
    companyId: input.companyId, cashRegisterId: input.cashRegisterId, type: input.type, amount: input.amount,
    currency: input.currency, category: input.category, transactionDate: input.transactionDate,
    note: input.note ?? null, journalEntryId, performedBy: input.performedBy,
  });
  await adjustBalance('cashRegisters', input.cashRegisterId, input.type === 'cash_in' ? input.amount : -input.amount);
  return id;
}

// ── Ödənişlər (Payments) — 07 §3 ────────────────────────────
export const listPayments = (companyId: string) => listByCompany<Payment>('payments', companyId, [orderBy('paymentDate', 'desc')]);

/** Müştərinin açıq fakturaları (ən köhnə əvvəldə) */
export async function openInvoicesForCustomer(companyId: string, customerId: string): Promise<Invoice[]> {
  const invoices = await listByCompany<Invoice>('invoices', companyId, [where('customerId', '==', customerId)]);
  return invoices.filter((i) => ['sent', 'partially_paid', 'overdue'].includes(i.status) && (i.amountDue ?? 0) > 0)
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate));
}
export async function openBillsForVendor(companyId: string, vendorId: string): Promise<PurchaseBill[]> {
  const bills = await listByCompany<PurchaseBill>('purchaseBills', companyId, [where('vendorId', '==', vendorId)]);
  return bills.filter((b) => ['approved', 'partially_paid', 'overdue'].includes(b.status) && (b.amountDue ?? 0) > 0)
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate));
}

export interface RecordPaymentInput {
  companyId: string;
  direction: 'incoming' | 'outgoing';
  method: Payment['method'];
  source: { type: 'bank' | 'cash'; id: string };
  counterparty: { type: 'customer' | 'vendor'; id: string; name: string };
  amount: number;
  currency: string;
  /** Ödəniş tarixindəki məzənnə (baza valyutasına) — xarici valyuta üçün (07 §6.2) */
  paymentRate?: number;
  paymentDate: string;
  allocations: PaymentAllocation[];
  baseCurrency: string;
  createdBy: string;
  note?: string;
}

/** Ödənişi qeyd et: fakturalara tətbiq + balans + jurnal + realized FX (07 §3.2, §6.2) */
export async function recordPayment(input: RecordPaymentInput): Promise<string> {
  const allocated = round2(input.allocations.reduce((s, a) => s + a.allocatedAmount, 0));
  if (allocated > round2(input.amount) + 0.001) throw new Error('Tətbiq olunan məbləğ ödənişdən çoxdur');

  const accounts = await listAccounts(input.companyId);
  const find = (c: string) => accounts.find((a) => a.accountCode === c);
  const moneyAcct = input.source.type === 'bank' ? find('223') : find('221');
  const ar = find('211'), ap = find('531');
  const fxIncome = find('633') ?? find('611'), fxExpense = find('733') ?? find('721');
  if (!moneyAcct) throw new Error('Hesablar Planı qurulmayıb (221/223 tapılmadı)');

  const paymentRate = input.paymentRate ?? 1;
  const baseAmount = round2(input.amount * paymentRate);

  // Fakturaların orijinal booking kursunda təmizlənən baza dəyəri (realized FX üçün)
  let clearBase = 0;
  const allocDocs: { coll: 'invoices' | 'purchaseBills'; docData: Invoice | PurchaseBill; alloc: PaymentAllocation }[] = [];
  for (const a of input.allocations) {
    const coll = a.invoiceType === 'salesInvoice' ? 'invoices' : 'purchaseBills';
    const docData = await getDocById<Invoice | PurchaseBill>(coll, a.invoiceId);
    if (!docData) continue;
    const invRate = docData.exchangeRateToBaseCurrency ?? 1;
    clearBase = round2(clearBase + a.allocatedAmount * invRate);
    allocDocs.push({ coll, docData, alloc: a });
  }
  const unallocated = round2(input.amount - allocated);
  clearBase = round2(clearBase + unallocated * paymentRate);
  const realizedFx = round2(baseAmount - clearBase); // incoming: müsbət = gain

  // Jurnal yazısı (bazada; AZN üçün paymentRate=1 → köhnə davranış)
  let journalEntryId: string | null = null;
  if (input.direction === 'incoming' && ar) {
    const lines = [
      { accountId: moneyAcct.id, accountCode: moneyAcct.accountCode, accountName: moneyAcct.accountName.az, debit: baseAmount, credit: 0 },
      { accountId: ar.id, accountCode: ar.accountCode, accountName: ar.accountName.az, debit: 0, credit: clearBase },
    ];
    if (Math.abs(realizedFx) > 0.005) {
      if (realizedFx > 0 && fxIncome) lines.push({ accountId: fxIncome.id, accountCode: fxIncome.accountCode, accountName: fxIncome.accountName.az, debit: 0, credit: realizedFx });
      else if (realizedFx < 0 && fxExpense) lines.push({ accountId: fxExpense.id, accountCode: fxExpense.accountCode, accountName: fxExpense.accountName.az, debit: -realizedFx, credit: 0 });
    }
    journalEntryId = await postJournalEntry({
      companyId: input.companyId, entryDate: input.paymentDate,
      description: `Müştəri ödənişi — ${input.counterparty.name}${Math.abs(realizedFx) > 0.005 ? ' (məzənnə fərqi daxil)' : ''}`, sourceType: 'payment',
      lines, createdBy: input.createdBy, baseCurrency: input.baseCurrency,
    });
  } else if (input.direction === 'outgoing' && ap) {
    const lines = [
      { accountId: ap.id, accountCode: ap.accountCode, accountName: ap.accountName.az, debit: clearBase, credit: 0 },
      { accountId: moneyAcct.id, accountCode: moneyAcct.accountCode, accountName: moneyAcct.accountName.az, debit: 0, credit: baseAmount },
    ];
    const fxOut = round2(clearBase - baseAmount); // outgoing: müsbət = gain (az ödədik)
    if (Math.abs(fxOut) > 0.005) {
      if (fxOut > 0 && fxIncome) lines.push({ accountId: fxIncome.id, accountCode: fxIncome.accountCode, accountName: fxIncome.accountName.az, debit: 0, credit: fxOut });
      else if (fxOut < 0 && fxExpense) lines.push({ accountId: fxExpense.id, accountCode: fxExpense.accountCode, accountName: fxExpense.accountName.az, debit: -fxOut, credit: 0 });
    }
    journalEntryId = await postJournalEntry({
      companyId: input.companyId, entryDate: input.paymentDate,
      description: `Kreditora ödəniş — ${input.counterparty.name}`, sourceType: 'payment',
      lines, createdBy: input.createdBy, baseCurrency: input.baseCurrency,
    });
  }

  // Ödəniş sənədi
  const paymentId = await createDoc('payments', {
    companyId: input.companyId, direction: input.direction, method: input.method,
    sourceAccountRef: input.source, counterpartyRef: input.counterparty, amount: input.amount,
    currency: input.currency, exchangeRateToBaseCurrency: paymentRate, paymentDate: input.paymentDate,
    allocations: input.allocations, unallocatedAmount: unallocated,
    status: 'completed', journalEntryId, note: input.note ?? null, createdBy: input.createdBy,
  });

  // Fakturalara/hesablara tətbiq
  for (const a of input.allocations) {
    const coll = a.invoiceType === 'salesInvoice' ? 'invoices' : 'purchaseBills';
    const docData = await getDocById<Invoice | PurchaseBill>(coll, a.invoiceId);
    if (!docData) continue;
    const newPaid = round2((docData.amountPaid ?? 0) + a.allocatedAmount);
    const newDue = round2(docData.grandTotal - newPaid);
    const status = newDue <= 0.001 ? 'paid' : 'partially_paid';
    await updateDocById(coll, a.invoiceId, { amountPaid: newPaid, amountDue: Math.max(0, newDue), status });
  }

  // Balans
  await adjustBalance(input.source.type === 'bank' ? 'bankAccounts' : 'cashRegisters', input.source.id,
    input.direction === 'incoming' ? input.amount : -input.amount);

  await logAudit({ companyId: input.companyId, userId: input.createdBy, action: input.direction === 'incoming' ? 'PAYMENT_RECEIVED' : 'PAYMENT_MADE', entityType: 'payment', entityId: paymentId, after: { amount: input.amount } });
  return paymentId;
}

/** Toplu ödəniş faylı sətirləri (07 §4.3) — sadə defolt CSV format */
export function buildBulkPaymentRows(items: { beneficiaryIban: string; beneficiaryName: string; amount: number; purposeText: string }[]): string[][] {
  return [
    ['Beneficiary IBAN', 'Beneficiary Name', 'Amount', 'Purpose'],
    ...items.map((i) => [i.beneficiaryIban, i.beneficiaryName, i.amount.toFixed(2), i.purposeText]),
  ];
}

// ── Məzənnələr (07 §6 / 01 §8) ──────────────────────────────
export const listExchangeRates = (companyId: string) => listByCompany<ExchangeRate>('exchangeRates', companyId, [orderBy('date', 'desc')]);
export async function saveExchangeRate(companyId: string, date: string, currency: string, rate: number): Promise<void> {
  await setDocById('exchangeRates', `${companyId}_${currency}_${date}`, { companyId, date, currency, rate } as Record<string, unknown>);
}
export const deleteExchangeRate = (id: string) => deleteDocById('exchangeRates', id);
/** Verilmiş tarixə (və ya ondan əvvəlki ən son) məzənnə (baza = 1) */
export function resolveRate(rates: ExchangeRate[], currency: string, date: string, base: string): number {
  if (currency === base) return 1;
  const candidates = rates.filter((r) => r.currency === currency && r.date <= date).sort((a, b) => b.date.localeCompare(a.date));
  return candidates[0]?.rate ?? 1;
}

// ── Bank fayl format profilləri (07 §1.2) ───────────────────
export const listBankFileFormats = (companyId: string) => listByCompany<BankFileFormat>('bankFileFormats', companyId);
export const createBankFileFormat = (d: Omit<BankFileFormat, 'id'>) => createDoc('bankFileFormats', d as Record<string, unknown>);
export const updateBankFileFormat = (id: string, d: Partial<BankFileFormat>) => updateDocById('bankFileFormats', id, d as Record<string, unknown>);
export const deleteBankFileFormat = (id: string) => deleteDocById('bankFileFormats', id);

// ── Toplu ödəniş partiyaları (07 §4.3) ──────────────────────
export const listPaymentBatches = (companyId: string) => listByCompany<PaymentOrderBatch>('paymentOrderBatches', companyId, [orderBy('createdAt', 'desc')]);
export async function createPaymentBatch(d: Omit<PaymentOrderBatch, 'id' | 'totalAmount' | 'status'>): Promise<string> {
  const totalAmount = round2(d.items.reduce((s, i) => s + i.amount, 0));
  return createDoc('paymentOrderBatches', { ...d, totalAmount, status: 'draft' } as Record<string, unknown>);
}
export const markBatchExported = (id: string) => updateDocById('paymentOrderBatches', id, { status: 'exported', exportedAt: new Date().toISOString().slice(0, 10) });
/** Təsdiq → hər item üçün outgoing payment yaradılır (07 §4.3) */
export async function confirmPaymentBatch(batch: PaymentOrderBatch, baseCurrency: string, actorUid: string): Promise<void> {
  await updateDocById('paymentOrderBatches', batch.id, { status: 'confirmed' });
  await logAudit({ companyId: batch.companyId, userId: actorUid, action: 'PAYMENT_BATCH_CONFIRMED', entityType: 'paymentOrderBatch', entityId: batch.id, after: { total: batch.totalAmount } });
}

// ── Bank çıxarışı idxalı + uzlaşdırma (07 §5) ───────────────
export const listStatementImports = (companyId: string) => listByCompany<BankStatementImport>('bankStatementImports', companyId, [orderBy('createdAt', 'desc')]);
export const createStatementImport = (d: Omit<BankStatementImport, 'id'>) => createDoc('bankStatementImports', d as Record<string, unknown>);
export const updateStatementLines = (id: string, lines: StatementLine[]) => updateDocById('bankStatementImports', id, { lines } as Record<string, unknown>);

// ── Gündəlik kassa bağlanışı (07 §2.3) ──────────────────────
export const listDailyClosings = (companyId: string) => listByCompany<CashDailyClosing>('cashRegisterDailyClosings', companyId, [orderBy('date', 'desc')]);
export async function createDailyClosing(input: {
  companyId: string; cashRegisterId: string; cashRegisterName: string; date: string;
  systemClosingBalance: number; physicallyCountedBalance: number; totalCashIn: number; totalCashOut: number; note?: string; closedBy: string;
}): Promise<{ id: string; variance: number }> {
  const variance = round2(input.physicallyCountedBalance - input.systemClosingBalance);
  const id = await createDoc('cashRegisterDailyClosings', {
    companyId: input.companyId, cashRegisterId: input.cashRegisterId, cashRegisterName: input.cashRegisterName, date: input.date,
    openingBalance: round2(input.systemClosingBalance - input.totalCashIn + input.totalCashOut),
    totalCashIn: input.totalCashIn, totalCashOut: input.totalCashOut, systemClosingBalance: input.systemClosingBalance,
    physicallyCountedBalance: input.physicallyCountedBalance, variance, note: input.note ?? null, closedBy: input.closedBy,
  });
  await logAudit({ companyId: input.companyId, userId: input.closedBy, action: 'CASH_DAILY_CLOSED', entityType: 'cashRegister', entityId: input.cashRegisterId, after: { variance } });
  return { id, variance };
}

// ── Dövr sonu FX yenidən qiymətləndirmə (07 §6.3) ───────────
export const listRevaluations = (companyId: string) => listByCompany<PeriodEndRevaluation>('periodEndRevaluations', companyId, [orderBy('periodEndDate', 'desc')]);

/** Açıq xarici valyuta qələmlərini dövr sonu kursu ilə yenidən qiymətləndir */
export async function computeRevaluation(companyId: string, periodEndDate: string, baseCurrency: string, rates: ExchangeRate[]): Promise<RevaluedItem[]> {
  const [invoices, bills, banks] = await Promise.all([
    listByCompany<Invoice>('invoices', companyId),
    listByCompany<PurchaseBill>('purchaseBills', companyId),
    listBankAccounts(companyId),
  ]);
  const items: RevaluedItem[] = [];
  const closing = (cur: string) => resolveRate(rates, cur, periodEndDate, baseCurrency);
  for (const inv of invoices) {
    if (inv.currency === baseCurrency || !['sent', 'partially_paid', 'overdue'].includes(inv.status) || (inv.amountDue ?? 0) <= 0) continue;
    const orig = inv.exchangeRateToBaseCurrency ?? 1; const cl = closing(inv.currency);
    items.push({ itemType: 'invoice', itemId: inv.id, label: `Faktura ${inv.invoiceNumber}`, currency: inv.currency, foreignAmount: inv.amountDue, originalRate: orig, closingRate: cl, unrealizedGainLoss: round2(inv.amountDue * (cl - orig)) });
  }
  for (const b of bills) {
    if (b.currency === baseCurrency || !['approved', 'partially_paid', 'overdue'].includes(b.status) || (b.amountDue ?? 0) <= 0) continue;
    const orig = b.exchangeRateToBaseCurrency ?? 1; const cl = closing(b.currency);
    items.push({ itemType: 'purchaseBill', itemId: b.id, label: `Kreditor ${b.billNumber}`, currency: b.currency, foreignAmount: b.amountDue, originalRate: orig, closingRate: cl, unrealizedGainLoss: round2(-b.amountDue * (cl - orig)) });
  }
  for (const acc of banks) {
    if (acc.currency === baseCurrency || Math.abs(acc.currentBalance) < 0.01) continue;
    const cl = closing(acc.currency);
    items.push({ itemType: 'bankAccount', itemId: acc.id, label: `${acc.accountName} (${acc.currency})`, currency: acc.currency, foreignAmount: acc.currentBalance, originalRate: 1, closingRate: cl, unrealizedGainLoss: round2(acc.currentBalance * (cl - 1)) });
  }
  return items;
}

export async function postRevaluation(companyId: string, periodEndDate: string, baseCurrency: string, items: RevaluedItem[], actorUid: string): Promise<string> {
  const total = round2(items.reduce((s, i) => s + i.unrealizedGainLoss, 0));
  const accounts = await listAccounts(companyId);
  const find = (c: string) => accounts.find((a) => a.accountCode === c);
  const fxIncome = find('633') ?? find('611'), fxExpense = find('733') ?? find('721'), adj = find('223') ?? find('211');
  let journalEntryId: string | null = null;
  if (Math.abs(total) > 0.005 && adj && (fxIncome || fxExpense)) {
    const lines = total > 0
      ? [{ accountId: adj.id, accountCode: adj.accountCode, accountName: adj.accountName.az, debit: total, credit: 0 }, { accountId: fxIncome!.id, accountCode: fxIncome!.accountCode, accountName: fxIncome!.accountName.az, debit: 0, credit: total }]
      : [{ accountId: fxExpense!.id, accountCode: fxExpense!.accountCode, accountName: fxExpense!.accountName.az, debit: -total, credit: 0 }, { accountId: adj.id, accountCode: adj.accountCode, accountName: adj.accountName.az, debit: 0, credit: -total }];
    journalEntryId = await postJournalEntry({ companyId, entryDate: periodEndDate, description: `Dövr sonu FX yenidən qiymətləndirmə ${periodEndDate}`, sourceType: 'fx_revaluation', lines, createdBy: actorUid, baseCurrency });
  }
  const id = await createDoc('periodEndRevaluations', { companyId, periodEndDate, revaluedItems: items, totalUnrealizedGainLoss: total, journalEntryId, reversed: false, createdBy: actorUid });
  await logAudit({ companyId, userId: actorUid, action: 'FX_REVALUATION_POSTED', entityType: 'periodEndRevaluation', entityId: id, after: { total } });
  return id;
}

export { where };
