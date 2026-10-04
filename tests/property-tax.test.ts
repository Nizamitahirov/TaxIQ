import { describe, it, expect } from 'vitest';
import { propertyRows, landRows } from '@/lib/firebase/property-tax';
import type { PropertyTaxAsset, LandPlot } from '@/types';

const pa = (opening: number, closing: number): PropertyTaxAsset =>
  ({ id: 'x', companyId: 'c', name: 'bina', openingResidual: opening, closingResidual: closing, year: 2026 });
const lp = (areaUnits: number, tariffPerUnit: number): LandPlot =>
  ({ id: 'x', companyId: 'c', location: 'Bakı', areaUnits, tariffPerUnit, year: 2026 });

describe('property-tax register (m.199-201)', () => {
  it('average annual value → 1% tax → 20% advance', () => {
    const { rows, totalTax, totalAdvance } = propertyRows([pa(100000, 80000)]);
    expect(rows[0].averageValue).toBe(90000);
    expect(rows[0].tax).toBe(900);
    expect(rows[0].advance).toBe(180);
    expect(totalTax).toBe(900);
    expect(totalAdvance).toBe(180);
  });
  it('sums multiple assets', () => {
    const { totalTax } = propertyRows([pa(100000, 100000), pa(50000, 50000)]);
    expect(totalTax).toBe(1500); // (1000 + 500)
  });
});

describe('land-tax register (m.206-210)', () => {
  it('area × tariff, summed', () => {
    const { rows, totalTax } = landRows([lp(1000, 0.06), lp(500, 0.1)]);
    expect(rows[0].tax).toBe(60);
    expect(totalTax).toBe(110);
  });
});
