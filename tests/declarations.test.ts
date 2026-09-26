import { describe, it, expect } from 'vitest';
import { computeVat, computeWithholding, computeProfitTax } from '@/lib/tax/declarations';
import type { Invoice, PurchaseBill, PayrollRun } from '@/types';

const inv = (o: Partial<Invoice>): Invoice => ({
  id: 'i', companyId: 'c', invoiceNumber: 'INV-1', customerId: 'x', issueDate: '2026-03-10', dueDate: '2026-04-10',
  lineItems: [], subtotal: 0, discountTotal: 0, vatTotal: 0, grandTotal: 0, currency: 'AZN', amountPaid: 0, amountDue: 0,
  status: 'sent', ...o,
} as Invoice);
const bill = (o: Partial<PurchaseBill>): PurchaseBill => ({
  id: 'b', companyId: 'c', billNumber: 'BILL-1', vendorId: 'v', issueDate: '2026-03-12', dueDate: '2026-04-12',
  lineItems: [], subtotal: 0, vatTotal: 0, grandTotal: 0, currency: 'AZN', amountPaid: 0, amountDue: 0, status: 'approved', ...o,
} as PurchaseBill);

describe('computeVat', () => {
  it('nets output minus input VAT for the period', () => {
    const invoices = [inv({ subtotal: 1000, vatTotal: 180, grandTotal: 1180, issueDate: '2026-03-05' })];
    const bills = [bill({ subtotal: 500, vatTotal: 90, grandTotal: 590, issueDate: '2026-03-20' })];
    const r = computeVat(invoices, bills, { year: 2026, month: 3 });
    expect(r.outputVat).toBe(180);
    expect(r.inputVat).toBe(90);
    expect(r.payable).toBe(90);
    expect(r.sales).toHaveLength(1);
    expect(r.purchases).toHaveLength(1);
  });

  it('excludes drafts, cancelled and out-of-period docs', () => {
    const invoices = [
      inv({ status: 'draft', vatTotal: 100, issueDate: '2026-03-05' }),
      inv({ status: 'cancelled', vatTotal: 100, issueDate: '2026-03-05' }),
      inv({ vatTotal: 50, issueDate: '2026-02-05' }), // başqa ay
    ];
    const r = computeVat(invoices, [], { year: 2026, month: 3 });
    expect(r.outputVat).toBe(0);
  });

  it('supports quarterly periods', () => {
    const invoices = [inv({ vatTotal: 20, issueDate: '2026-01-15' }), inv({ vatTotal: 30, issueDate: '2026-03-15' })];
    const r = computeVat(invoices, [], { year: 2026, quarter: 1 });
    expect(r.outputVat).toBe(50);
  });
});

describe('computeWithholding', () => {
  it('aggregates income tax and contributions by employee', () => {
    const runs: PayrollRun[] = [{
      periodYear: 2026, periodMonth: 3, status: 'approved',
      lines: [
        { employeeId: 'e1', employeeName: 'Ali', grossSalary: 1000, incomeTax: 140, employeeSocialInsurance: 30, employeeUnemploymentInsurance: 5, employeeMedicalInsurance: 20 },
        { employeeId: 'e1', employeeName: 'Ali', grossSalary: 500, incomeTax: 70, employeeSocialInsurance: 15, employeeUnemploymentInsurance: 2.5, employeeMedicalInsurance: 10 },
      ],
    } as unknown as PayrollRun];
    const r = computeWithholding(runs, { year: 2026, month: 3 });
    expect(r.incomeTax).toBe(210);
    expect(r.gross).toBe(1500);
    expect(r.lines).toHaveLength(1);
  });

  it('ignores draft runs and other periods', () => {
    const runs: PayrollRun[] = [
      { periodYear: 2026, periodMonth: 3, status: 'draft', lines: [{ employeeId: 'e', employeeName: 'X', grossSalary: 100, incomeTax: 14 }] },
      { periodYear: 2025, periodMonth: 3, status: 'approved', lines: [{ employeeId: 'e', employeeName: 'X', grossSalary: 100, incomeTax: 14 }] },
    ] as unknown as PayrollRun[];
    const r = computeWithholding(runs, { year: 2026, month: 3 });
    expect(r.incomeTax).toBe(0);
  });
});

describe('computeProfitTax', () => {
  it('applies 20% to positive profit', () => {
    expect(computeProfitTax(1000).tax).toBe(200);
  });
  it('is zero for a loss', () => {
    expect(computeProfitTax(-500).tax).toBe(0);
  });
});
