/**
 * İl bağlanışı — gəlir (sinif 6) və xərc (sinif 7) hesablarının bağlanması,
 * xalis nəticənin 341 (hesabat dövrü mənfəəti) → 344 (keçmiş illər) köçürülməsi.
 * «Mühasibat uçotu haqqında» Qanun — dövrün bağlanması (B11).
 *
 * Təhlükəsiz dizayn: funksiya yalnız TƏKLİF olunan jurnal sətirlərini hesablayır;
 * post etmək UI-dakı açıq təsdiqlə baş verir.
 */

export interface ClosingAccount {
  accountId: string;
  accountCode: string;
  accountName: string;
  /** cari qalıq (müsbət = debet, mənfəət hesabatına görə) */
  balance: number;       // Math.abs
  normalBalance: 'debit' | 'credit';
}

export interface ClosingLine {
  accountId: string; accountCode: string; accountName: string; debit: number; credit: number;
}

export interface YearEndPlan {
  revenueTotal: number;
  expenseTotal: number;
  netProfit: number;      // mənfəət > 0, zərər < 0
  /** 6xx/7xx → 341 bağlanışı */
  closingLines: ClosingLine[];
  /** 341 → 344 köçürmə */
  transferLines: ClosingLine[];
  ok: boolean;            // 341/344 hesabları tapıldımı
  message?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface YearEndAccounts {
  profitSummaryId?: string;   // 341
  profitSummaryName?: string;
  retainedId?: string;        // 344
  retainedName?: string;
}

/**
 * @param rows trial-balance sətirləri (yalnız qalığı olan hesablar)
 * @param acc  341 / 344 hesab məlumatları
 */
export function computeYearEndClosing(rows: ClosingAccount[], acc: YearEndAccounts): YearEndPlan {
  const revenue = rows.filter((r) => r.accountCode.startsWith('6') && r.balance > 0);
  const expense = rows.filter((r) => r.accountCode.startsWith('7') && r.balance > 0);
  // Gəlir kredit-normaldır → qalıq onun kredit tərəfindədir; bağlamaq üçün debet edirik
  const revenueTotal = round2(revenue.reduce((s, r) => s + r.balance, 0));
  const expenseTotal = round2(expense.reduce((s, r) => s + r.balance, 0));
  const netProfit = round2(revenueTotal - expenseTotal);

  const closingLines: ClosingLine[] = [];
  const summary = acc.profitSummaryId
    ? { accountId: acc.profitSummaryId, accountCode: '341', accountName: acc.profitSummaryName ?? 'Xalis mənfəət (zərər)' }
    : null;
  const retained = acc.retainedId
    ? { accountId: acc.retainedId, accountCode: '344', accountName: acc.retainedName ?? 'Keçmiş illər mənfəəti' }
    : null;

  if (!summary || !retained) {
    return { revenueTotal, expenseTotal, netProfit, closingLines: [], transferLines: [], ok: false,
      message: '341/344 hesabları Hesablar Planında tapılmadı' };
  }

  // Gəlirləri bağla: Dt gəlir / Kt 341
  for (const r of revenue) closingLines.push({ accountId: r.accountId, accountCode: r.accountCode, accountName: r.accountName, debit: r.balance, credit: 0 });
  if (revenueTotal > 0) closingLines.push({ ...summary, debit: 0, credit: revenueTotal });
  // Xərcləri bağla: Dt 341 / Kt xərc
  if (expenseTotal > 0) closingLines.push({ ...summary, debit: expenseTotal, credit: 0 });
  for (const e of expense) closingLines.push({ accountId: e.accountId, accountCode: e.accountCode, accountName: e.accountName, debit: 0, credit: e.balance });

  // Nəticəni köçür: mənfəət → Dt 341 / Kt 344; zərər → əksinə
  const transferLines: ClosingLine[] = [];
  if (netProfit > 0) {
    transferLines.push({ ...summary, debit: netProfit, credit: 0 });
    transferLines.push({ ...retained, debit: 0, credit: netProfit });
  } else if (netProfit < 0) {
    transferLines.push({ ...retained, debit: -netProfit, credit: 0 });
    transferLines.push({ ...summary, debit: 0, credit: -netProfit });
  }

  return { revenueTotal, expenseTotal, netProfit, closingLines, transferLines, ok: true };
}
