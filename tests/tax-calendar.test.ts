import { describe, it, expect } from 'vitest';
import { obligationsFor, upcomingDeadlines, AZ_TAX_DEADLINES } from '@/lib/tax/calendar';

describe('tax calendar — obligations by profile', () => {
  it('standard VAT payer with staff: vat + profit + withholding', () => {
    const o = obligationsFor({ vatPayer: true, hasEmployees: true });
    expect(o).toContain('vat');
    expect(o).toContain('profit');
    expect(o).toContain('withholding');
    expect(o).not.toContain('simplified');
  });
  it('simplified payer: simplified, no profit/vat', () => {
    const o = obligationsFor({ simplifiedPayer: true, vatPayer: true });
    expect(o).toContain('simplified');
    expect(o).not.toContain('profit');
    expect(o).not.toContain('vat');
  });
  it('property + land owner adds those', () => {
    const o = obligationsFor({ ownsProperty: true, ownsLand: true });
    expect(o).toEqual(expect.arrayContaining(['property', 'property_advance', 'land']));
  });
});

describe('tax calendar — deadlines', () => {
  it('VAT monthly due on the 20th of the following month', () => {
    const list = upcomingDeadlines({ vatPayer: true }, new Date('2026-01-05'), 2);
    const vat = list.find((d) => d.kind === 'vat');
    expect(vat?.dueDate).toBe('2026-01-20'); // December period
    expect(vat?.periodLabel).toBe('2025-12');
  });
  it('profit tax annual due March 31', () => {
    const list = upcomingDeadlines({ vatPayer: true }, new Date('2026-01-05'), 6);
    const profit = list.find((d) => d.kind === 'profit');
    expect(profit?.dueDate).toBe('2026-03-31');
  });
  it('land tax annual due May 15', () => {
    const list = upcomingDeadlines({ ownsLand: true }, new Date('2026-01-05'), 6);
    expect(list.find((d) => d.kind === 'land')?.dueDate).toBe('2026-05-15');
  });
  it('property advance on the 15th of the quarter second month', () => {
    const list = upcomingDeadlines({ ownsProperty: true }, new Date('2026-01-05'), 3);
    const adv = list.find((d) => d.kind === 'property_advance');
    expect(adv?.dueDate).toBe('2026-02-15');
  });
  it('results are sorted ascending and carry daysUntil', () => {
    const list = upcomingDeadlines({ vatPayer: true, hasEmployees: true }, new Date('2026-01-05'), 3);
    for (let i = 1; i < list.length; i++) expect(list[i].dueDate >= list[i - 1].dueDate).toBe(true);
    expect(list[0].daysUntil).toBeGreaterThanOrEqual(0);
  });
  it('every obligation has a legal reference', () => {
    expect(Object.values(AZ_TAX_DEADLINES).every((d) => d.reference.startsWith('m.'))).toBe(true);
  });
});
