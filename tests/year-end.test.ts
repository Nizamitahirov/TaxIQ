import { describe, it, expect } from 'vitest';
import { computeYearEndClosing, type ClosingAccount } from '@/lib/accounting/year-end';

const acc = { profitSummaryId: 's341', profitSummaryName: 'Xalis mənfəət', retainedId: 'r344', retainedName: 'Keçmiş illər' };
const row = (accountCode: string, balance: number, normalBalance: 'debit' | 'credit'): ClosingAccount =>
  ({ accountId: accountCode, accountCode, accountName: accountCode, balance, normalBalance });

const sum = (lines: { debit: number; credit: number }[]) => ({
  d: Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100,
  c: Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100) / 100,
});

describe('year-end closing (B11)', () => {
  it('computes net profit and balanced closing entry', () => {
    const plan = computeYearEndClosing([row('601', 10000, 'credit'), row('701', 6000, 'debit'), row('722', 1000, 'debit')], acc);
    expect(plan.revenueTotal).toBe(10000);
    expect(plan.expenseTotal).toBe(7000);
    expect(plan.netProfit).toBe(3000);
    const s = sum(plan.closingLines);
    expect(s.d).toBe(s.c); // ikili yazılış balanslıdır
  });
  it('profit transfers 341 → 344 (debit 341, credit 344)', () => {
    const plan = computeYearEndClosing([row('601', 5000, 'credit'), row('701', 2000, 'debit')], acc);
    expect(plan.transferLines.find((l) => l.accountCode === '341')?.debit).toBe(3000);
    expect(plan.transferLines.find((l) => l.accountCode === '344')?.credit).toBe(3000);
  });
  it('loss reverses the transfer', () => {
    const plan = computeYearEndClosing([row('601', 2000, 'credit'), row('701', 5000, 'debit')], acc);
    expect(plan.netProfit).toBe(-3000);
    expect(plan.transferLines.find((l) => l.accountCode === '344')?.debit).toBe(3000);
    expect(plan.transferLines.find((l) => l.accountCode === '341')?.credit).toBe(3000);
  });
  it('fails gracefully without 341/344', () => {
    const plan = computeYearEndClosing([row('601', 100, 'credit')], {});
    expect(plan.ok).toBe(false);
    expect(plan.closingLines).toHaveLength(0);
  });
  it('ignores non 6/7 accounts', () => {
    const plan = computeYearEndClosing([row('223', 999, 'debit'), row('601', 100, 'credit')], acc);
    expect(plan.revenueTotal).toBe(100);
    expect(plan.expenseTotal).toBe(0);
  });
});
