import { generateProfitLoss, generateBalanceSheet, yearPeriod, type FinancialStatement, type StatementRow } from './engine';

const round2 = (n: number) => Math.round(n * 100) / 100;

export type ConsolidatedKind = 'pl' | 'balance';

export interface CompanyColumn { companyId: string; name: string }
export interface ConsolidatedRow {
  label: string;
  level: number;
  bold?: boolean;
  subtotal?: boolean;
  /** companyId → cari dövr məbləği */
  byCompany: Record<string, number>;
  total: number;
}
export interface ConsolidatedStatement {
  title: string;
  periodLabel: string;
  columns: CompanyColumn[];
  rows: ConsolidatedRow[];
  balanced?: boolean;
}

/**
 * Bir neçə şirkətin IFRS hesabatlarını sətir-adına görə birləşdirir (qrup konsolidasiyası).
 * Bütün şirkətlər eyni rəsmi Hesablar Planı şablonundan istifadə etdiyi üçün sətir adları uyğun gəlir.
 * Qeyd: şirkətlərarası (intercompany) əməliyyatların eliminasiyası bu sadə versiyaya daxil deyil.
 */
export async function consolidate(
  companies: CompanyColumn[],
  year: number,
  kind: ConsolidatedKind,
): Promise<ConsolidatedStatement> {
  const cur = yearPeriod(year);
  const prior = yearPeriod(year - 1);
  const gen = kind === 'pl' ? generateProfitLoss : generateBalanceSheet;

  const perCompany = await Promise.all(
    companies.map(async (c) => ({ companyId: c.companyId, stmt: await gen(c.companyId, cur, prior) as FinancialStatement })),
  );

  // Sətir sırasını ilk (məzmunlu) hesabatdan götür
  const template = perCompany.find((p) => p.stmt.rows.length > 0)?.stmt.rows ?? [];
  const order: string[] = [];
  const meta = new Map<string, StatementRow>();
  for (const p of perCompany) {
    for (const r of p.stmt.rows) {
      if (!meta.has(r.label)) { meta.set(r.label, r); order.push(r.label); }
    }
  }
  void template;

  const rows: ConsolidatedRow[] = order.map((label) => {
    const m = meta.get(label)!;
    const byCompany: Record<string, number> = {};
    let total = 0;
    for (const p of perCompany) {
      const found = p.stmt.rows.find((r) => r.label === label);
      const val = round2(found?.current ?? 0);
      byCompany[p.companyId] = val;
      total = round2(total + val);
    }
    return { label, level: m.level, bold: m.bold, subtotal: m.subtotal, byCompany, total };
  });

  return {
    title: kind === 'pl' ? 'Konsolidə Mənfəət və Zərər' : 'Konsolidə Balans Hesabatı',
    periodLabel: cur.label,
    columns: companies,
    rows,
    balanced: kind === 'balance' ? perCompany.every((p) => p.stmt.balanced !== false) : undefined,
  };
}
