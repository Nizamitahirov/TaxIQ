'use client';

/**
 * Vergi bəyannamələri — real sistem datasından hesablama (Azərbaycan).
 *  • ƏDV (18%): çıxış ƏDV (satış fakturaları) − giriş ƏDV (alış fakturaları)
 *  • Ödəmə mənbəyində tutulan vergi: əmək haqqından tutulan gəlir vergisi
 *  • Mənfəət vergisi (20%): vergiyə cəlb olunan mənfəət × 20%
 * Hesablamalar artıq sənədlərdə saxlanılan məbləğlərə əsaslanır (yenidən
 * hesablanmır) — beləcə mühasibatla uyğunluq qorunur.
 */
import type { Invoice, PurchaseBill, PayrollRun } from '@/types';

export const VAT_RATE = 0.18;
export const PROFIT_TAX_RATE = 0.20;

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface TaxPeriod {
  year: number;
  /** aylıq bəyannamələr üçün (ƏDV, ödəmə mənbəyi) */
  month?: number;
  /** rüblük hesablama üçün */
  quarter?: number;
}

/** Verilən tarix (YYYY-MM-DD) seçilmiş dövrə düşürmü? */
function inPeriod(dateStr: string, p: TaxPeriod): boolean {
  if (!dateStr) return false;
  const [y, m] = dateStr.split('-').map(Number);
  if (y !== p.year) return false;
  if (p.month) return m === p.month;
  if (p.quarter) return m >= p.quarter * 3 - 2 && m <= p.quarter * 3;
  return true; // illik
}

// ── ƏDV bəyannaməsi ─────────────────────────────────────────────────────────
export interface VatLine { date: string; number: string; party: string; base: number; vat: number }
export interface VatDeclaration {
  outputVat: number; inputVat: number; payable: number;
  salesBase: number; purchaseBase: number;
  sales: VatLine[]; purchases: VatLine[];
}

export function computeVat(invoices: Invoice[], bills: PurchaseBill[], p: TaxPeriod): VatDeclaration {
  const sales = invoices
    .filter((i) => i.status !== 'draft' && i.status !== 'cancelled' && inPeriod(i.issueDate, p))
    .map((i) => ({ date: i.issueDate, number: i.invoiceNumber, party: i.customerName ?? '—', base: round2(i.subtotal - (i.discountTotal || 0)), vat: round2(i.vatTotal || 0) }));
  const purchases = bills
    .filter((b) => b.status !== 'draft' && b.status !== 'cancelled' && inPeriod(b.issueDate, p))
    .map((b) => ({ date: b.issueDate, number: b.billNumber, party: b.vendorName ?? '—', base: round2(b.subtotal || 0), vat: round2(b.vatTotal || 0) }));
  const outputVat = round2(sales.reduce((s, x) => s + x.vat, 0));
  const inputVat = round2(purchases.reduce((s, x) => s + x.vat, 0));
  return {
    outputVat, inputVat, payable: round2(outputVat - inputVat),
    salesBase: round2(sales.reduce((s, x) => s + x.base, 0)),
    purchaseBase: round2(purchases.reduce((s, x) => s + x.base, 0)),
    sales, purchases,
  };
}

// ── Ödəmə mənbəyində tutulan vergi (muzdlu iş) ──────────────────────────────
export interface WhLine { employee: string; gross: number; incomeTax: number; social: number; unemployment: number; medical: number }
export interface WithholdingDeclaration {
  incomeTax: number; social: number; unemployment: number; medical: number; gross: number;
  lines: WhLine[];
}

export function computeWithholding(runs: PayrollRun[], p: TaxPeriod): WithholdingDeclaration {
  const months = p.month ? [p.month] : p.quarter ? [p.quarter * 3 - 2, p.quarter * 3 - 1, p.quarter * 3] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const periodRuns = runs.filter((r) => r.periodYear === p.year && months.includes(r.periodMonth) && r.status !== 'draft');
  const agg = new Map<string, WhLine>();
  for (const r of periodRuns) {
    for (const l of r.lines) {
      const key = l.employeeName || l.employeeId;
      const cur = agg.get(key) ?? { employee: key, gross: 0, incomeTax: 0, social: 0, unemployment: 0, medical: 0 };
      cur.gross += l.grossSalary || 0;
      cur.incomeTax += l.incomeTax || 0;
      cur.social += l.employeeSocialInsurance || 0;
      cur.unemployment += l.employeeUnemploymentInsurance || 0;
      cur.medical += l.employeeMedicalInsurance || 0;
      agg.set(key, cur);
    }
  }
  const lines = [...agg.values()].map((l) => ({
    employee: l.employee, gross: round2(l.gross), incomeTax: round2(l.incomeTax),
    social: round2(l.social), unemployment: round2(l.unemployment), medical: round2(l.medical),
  }));
  return {
    incomeTax: round2(lines.reduce((s, x) => s + x.incomeTax, 0)),
    social: round2(lines.reduce((s, x) => s + x.social, 0)),
    unemployment: round2(lines.reduce((s, x) => s + x.unemployment, 0)),
    medical: round2(lines.reduce((s, x) => s + x.medical, 0)),
    gross: round2(lines.reduce((s, x) => s + x.gross, 0)),
    lines,
  };
}

// ── Mənfəət vergisi ─────────────────────────────────────────────────────────
export interface ProfitTaxDeclaration { profit: number; rate: number; tax: number }
export function computeProfitTax(netProfit: number, rate = PROFIT_TAX_RATE): ProfitTaxDeclaration {
  const profit = round2(netProfit);
  return { profit, rate, tax: round2(Math.max(0, profit) * rate) };
}
