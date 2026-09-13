import { listInvoices, computeAging } from '@/lib/firebase/sales';
import { listPayments } from '@/lib/firebase/treasury';
import { listBankAccounts, listCashRegisters, listPurchaseBills } from '@/lib/firebase/treasury';
import { listStockBalances } from '@/lib/firebase/inventory';
import { listEmployees } from '@/lib/firebase/hr';
import { aggregatePendingApprovals } from '@/lib/firebase/workflow';
import type { Invoice } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;
const MONTHS_AZ = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'];

export interface LiveCompanyKpis {
  revenueThisMonth: number;
  revenueYtd: number;
  cashTotal: number;
  arTotal: number;
  apTotal: number;
  inventoryValue: number;
  activeEmployees: number;
  overdueCount: number;
  overdueAmount: number;
  pendingApprovals: number;
  invoiceCount: number;
  avgInvoice: number;
  collectionRate: number;   // ödənilmiş / ümumi (%)
  monthlyTarget: number;    // hədəf (əvvəlki 5 ayın ortası)
  targetPct: number;
  revenueTrend: { month: string; value: number; cumulative: number }[];
  agingBuckets: { name: string; value: number }[];
  statusDist: { name: string; value: number }[];
  topCustomers: { name: string; revenue: number }[];
  recentInvoices: Invoice[];
}

const STATUS_LABEL: Record<string, string> = {
  paid: 'Ödənilib', partially_paid: 'Qismən', overdue: 'Vaxtı keçib', sent: 'Göndərilib', draft: 'Qaralama', cancelled: 'Ləğv',
};

export async function loadLiveCompanyKpis(companyId: string): Promise<LiveCompanyKpis> {
  const [invoices, payments, banks, cash, bills, stock, employees, pending] = await Promise.all([
    listInvoices(companyId), listPayments(companyId), listBankAccounts(companyId),
    listCashRegisters(companyId), listPurchaseBills(companyId), listStockBalances(companyId),
    listEmployees(companyId), aggregatePendingApprovals(companyId),
  ]);
  void payments;

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const yearStart = `${now.getFullYear()}-01-01`;

  const posted = invoices.filter((i) => i.status !== 'draft' && i.status !== 'cancelled');
  const netOf = (i: Invoice) => round2(i.subtotal - i.discountTotal);
  const revenueThisMonth = round2(posted.filter((i) => i.issueDate >= monthStart).reduce((s, i) => s + netOf(i), 0));
  const revenueYtd = round2(posted.filter((i) => i.issueDate >= yearStart).reduce((s, i) => s + netOf(i), 0));

  const cashTotal = round2(banks.reduce((s, b) => s + (b.currentBalance ?? 0), 0) + cash.reduce((s, c) => s + (c.currentBalance ?? 0), 0));
  const arTotal = round2(posted.reduce((s, i) => s + (i.amountDue ?? 0), 0));
  const apTotal = round2(bills.filter((b) => b.status !== 'draft' && b.status !== 'cancelled').reduce((s, b) => s + (b.amountDue ?? 0), 0));
  const inventoryValue = round2(stock.reduce((s, b) => s + (b.totalValue ?? 0), 0));
  const activeEmployees = employees.filter((e) => e.status === 'active').length;

  const aging = computeAging(invoices);
  const today = now.toISOString().slice(0, 10);
  const overdueInvoices = posted.filter((i) => i.status === 'overdue' || ((i.amountDue ?? 0) > 0 && i.dueDate < today));
  const overdueAmount = round2(overdueInvoices.reduce((s, i) => s + (i.amountDue ?? 0), 0));

  // Gəlir trendi + kümulyativ (6 ay)
  const buckets = new Map<string, number>();
  for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); buckets.set(`${d.getFullYear()}-${d.getMonth()}`, 0); }
  for (const inv of posted) { const d = new Date(inv.issueDate); const key = `${d.getFullYear()}-${d.getMonth()}`; if (buckets.has(key)) buckets.set(key, round2((buckets.get(key) ?? 0) + netOf(inv))); }
  let cum = 0;
  const revenueTrend = [...buckets.entries()].map(([k, v]) => { cum = round2(cum + v); return { month: MONTHS_AZ[Number(k.split('-')[1])], value: v, cumulative: cum }; });

  // Hədəf = əvvəlki 5 ayın ortası (cari istisna)
  const prev = revenueTrend.slice(0, 5).map((x) => x.value).filter((v) => v > 0);
  const monthlyTarget = prev.length ? round2(prev.reduce((a, b) => a + b, 0) / prev.length) : 0;
  const targetPct = monthlyTarget > 0 ? Math.min(100, round2((revenueThisMonth / monthlyTarget) * 100)) : 0;

  // Status bölgüsü (məbləğ üzrə)
  const statusMap = new Map<string, number>();
  for (const i of invoices) { if (i.status === 'cancelled') continue; statusMap.set(i.status, round2((statusMap.get(i.status) ?? 0) + i.grandTotal)); }
  const statusDist = [...statusMap.entries()].map(([k, v]) => ({ name: STATUS_LABEL[k] ?? k, value: v }));

  // Top müştərilər (gəlir üzrə)
  const custMap = new Map<string, number>();
  for (const i of posted) custMap.set(i.customerName ?? '—', round2((custMap.get(i.customerName ?? '—') ?? 0) + netOf(i)));
  const topCustomers = [...custMap.entries()].map(([name, revenue]) => ({ name, revenue })).sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  const totalInvoiced = round2(posted.reduce((s, i) => s + i.grandTotal, 0));
  const totalPaid = round2(posted.reduce((s, i) => s + (i.amountPaid ?? 0), 0));

  return {
    revenueThisMonth, revenueYtd, cashTotal, arTotal, apTotal, inventoryValue, activeEmployees,
    overdueCount: overdueInvoices.length, overdueAmount, pendingApprovals: pending.length,
    invoiceCount: posted.length, avgInvoice: posted.length ? round2(totalInvoiced / posted.length) : 0,
    collectionRate: totalInvoiced > 0 ? round2((totalPaid / totalInvoiced) * 100) : 0,
    monthlyTarget, targetPct,
    revenueTrend,
    agingBuckets: aging.rows.length ? [
      { name: '0-30', value: aging.totals.b0_30 }, { name: '31-60', value: aging.totals.b31_60 },
      { name: '61-90', value: aging.totals.b61_90 }, { name: '90+', value: aging.totals.b90 },
    ].filter((b) => b.value > 0) : [],
    statusDist,
    topCustomers,
    recentInvoices: [...posted].sort((a, b) => b.issueDate.localeCompare(a.issueDate)).slice(0, 6),
  };
}
