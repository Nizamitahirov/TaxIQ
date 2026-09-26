import { describe, it, expect } from 'vitest';
import { AZ_ASSET_CATEGORIES, ASSET_CATEGORY_MAP, DEFAULT_ASSET_CATEGORY } from '@/lib/accounting/asset-categories';
import { evenSplit } from '@/lib/firebase/budget';
import { weightedScore } from '@/lib/firebase/performance';
import { bomComponentsCost, scaleOrder } from '@/lib/firebase/production';
import { poTotals, mergeReceived, isFullyReceived, threeWayMatch } from '@/lib/firebase/purchasing';
import { lotExpiry } from '@/lib/firebase/lots';
import { monthlyDepreciation } from '@/lib/firebase/accounting';
import type { InventoryLot, PurchaseOrder, FixedAsset } from '@/types';

describe('asset categories (Tax Code Art.114)', () => {
  it('exposes the statutory rates', () => {
    expect(ASSET_CATEGORY_MAP['buildings'].taxRate).toBe(7);
    expect(ASSET_CATEGORY_MAP['machinery'].taxRate).toBe(25);
    expect(ASSET_CATEGORY_MAP['other'].taxRate).toBe(20);
    expect(AZ_ASSET_CATEGORIES.every((c) => c.defaultMethod === 'reducing_balance')).toBe(true);
    expect(ASSET_CATEGORY_MAP[DEFAULT_ASSET_CATEGORY]).toBeDefined();
  });
});

describe('budget evenSplit', () => {
  it('splits into 12 and preserves the annual total', () => {
    const arr = evenSplit(1000);
    expect(arr).toHaveLength(12);
    expect(Math.round(arr.reduce((s, v) => s + v, 0) * 100) / 100).toBe(1000);
  });
});

describe('performance weightedScore', () => {
  it('computes the weighted average', () => {
    expect(weightedScore([{ title: 'a', weight: 50, score: 4 }, { title: 'b', weight: 50, score: 2 }])).toBe(3);
  });
  it('falls back to a simple average when weights are zero', () => {
    expect(weightedScore([{ title: 'a', weight: 0, score: 4 }, { title: 'b', weight: 0, score: 2 }])).toBe(3);
  });
  it('is zero for no criteria', () => {
    expect(weightedScore([])).toBe(0);
  });
});

describe('production BOM', () => {
  it('sums component cost', () => {
    expect(bomComponentsCost([{ description: 'x', quantity: 2, unitCost: 3 }, { description: 'y', quantity: 1, unitCost: 4 }])).toBe(10);
  });
  it('scales a BOM to the order quantity', () => {
    const s = scaleOrder({ components: [{ description: 'x', quantity: 2, unitCost: 3 }], outputQuantity: 1, laborCost: 10, overheadCost: 5 }, 3);
    expect(s.materialCost).toBe(18); // 2*3*3
    expect(s.laborCost).toBe(30);
    expect(s.overheadCost).toBe(15);
    expect(s.totalCost).toBe(63);
    expect(s.unitCost).toBe(21);
  });
});

describe('purchasing', () => {
  it('poTotals computes subtotal, vat and grand total', () => {
    const t = poTotals([{ goodId: null, description: 'x', quantity: 2, unit: '', unitPrice: 100, discountPercent: 0, vatRate: 18 }]);
    expect(t.subtotal).toBe(200);
    expect(t.vatTotal).toBe(36);
    expect(t.grandTotal).toBe(236);
  });

  const po = (received?: number[]): PurchaseOrder => ({
    id: 'po', companyId: 'c', poNumber: 'PO-1', vendorId: 'v', orderDate: '2026-01-01',
    lineItems: [
      { goodId: null, description: 'A', quantity: 10, unit: '', unitPrice: 5, discountPercent: 0, vatRate: 18, lineTotal: 50 },
      { goodId: null, description: 'B', quantity: 4, unit: '', unitPrice: 5, discountPercent: 0, vatRate: 18, lineTotal: 20 },
    ],
    subtotal: 70, vatTotal: 12.6, grandTotal: 82.6, currency: 'AZN', status: 'confirmed', receivedQty: received,
  } as PurchaseOrder);

  it('merges received quantities and detects full receipt', () => {
    const p = po([3, 0]);
    const merged = mergeReceived(p, [7, 4]);
    expect(merged).toEqual([10, 4]);
    expect(isFullyReceived(p, merged)).toBe(true);
    expect(isFullyReceived(p, [10, 3])).toBe(false);
  });

  it('threeWayMatch flags matched lines', () => {
    const m = threeWayMatch(po([10, 2]));
    expect(m[0].matched).toBe(true);
    expect(m[1].matched).toBe(false);
    expect(m[1].received).toBe(2);
  });
});

describe('lotExpiry (FEFO)', () => {
  const base: InventoryLot = {
    id: 'l', companyId: 'c', goodId: 'g', warehouseId: 'w', lotNumber: 'L1', receivedDate: '2026-01-01',
    quantityReceived: 10, quantityRemaining: 10, status: 'active',
  } as InventoryLot;
  const today = new Date('2026-06-01');
  it('flags expired lots', () => {
    expect(lotExpiry({ ...base, expiryDate: '2026-05-01' }, today).state).toBe('expired');
  });
  it('flags soon-to-expire lots', () => {
    expect(lotExpiry({ ...base, expiryDate: '2026-06-20' }, today, 30).state).toBe('soon');
  });
  it('is ok when far out', () => {
    expect(lotExpiry({ ...base, expiryDate: '2027-01-01' }, today).state).toBe('ok');
  });
  it('is none without an expiry date', () => {
    expect(lotExpiry(base, today).state).toBe('none');
  });
});

describe('monthlyDepreciation', () => {
  const asset = (o: Partial<FixedAsset>): FixedAsset => ({
    id: 'a', companyId: 'c', assetName: 'x', acquisitionDate: '2026-01-01', acquisitionCost: 1200,
    depreciationMethod: 'straight_line', usefulLifeMonths: 12, residualValue: 0, accumulatedDepreciation: 0,
    netBookValue: 1200, status: 'active', ...o,
  } as FixedAsset);
  it('straight-line divides depreciable base by life', () => {
    expect(monthlyDepreciation(asset({}))).toBe(100);
  });
  it('reducing-balance uses the annual rate on NBV', () => {
    expect(monthlyDepreciation(asset({ depreciationMethod: 'reducing_balance', reducingBalanceRate: 24, netBookValue: 1000 }))).toBe(20);
  });
  it('is zero when not active', () => {
    expect(monthlyDepreciation(asset({ status: 'disposed' }))).toBe(0);
  });
});
