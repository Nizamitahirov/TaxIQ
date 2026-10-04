import { describe, it, expect } from 'vitest';
import { computeCustoms, lineCharges, transactionCustomsValue, IMPORT_VAT_RATE } from '@/lib/customs/engine';
import type { CustomsLine } from '@/types';

const line = (customsValue: number, dutyRate: number, exciseRate = 0, vatApplicable = true): CustomsLine =>
  ({ description: 'x', quantity: 1, customsValue, dutyRate, exciseRate, vatApplicable });

describe('customs charges (Customs Code)', () => {
  it('import: duty, then VAT on value+duty+excise', () => {
    const c = lineCharges(line(10000, 10), 'import'); // duty 1000; VAT (11000)×18% = 1980
    expect(c.duty).toBe(1000);
    expect(c.excise).toBe(0);
    expect(c.importVat).toBe(1980);
  });
  it('excise is included in the VAT base', () => {
    const c = lineCharges(line(10000, 0, 20), 'import'); // excise 2000; VAT (12000)×18% = 2160
    expect(c.excise).toBe(2000);
    expect(c.importVat).toBe(2160);
  });
  it('export carries no duty/VAT', () => {
    const c = lineCharges(line(10000, 10, 20), 'export');
    expect(c.duty).toBe(0); expect(c.importVat).toBe(0); expect(c.excise).toBe(0);
  });
  it('vatApplicable=false suppresses import VAT', () => {
    expect(lineCharges(line(10000, 10, 0, false), 'import').importVat).toBe(0);
  });
  it('VAT rate is 18%', () => expect(IMPORT_VAT_RATE).toBe(0.18));
});

describe('computeCustoms totals', () => {
  it('sums lines + customs fee', () => {
    const t = computeCustoms([line(10000, 10), line(5000, 0, 0)], 'import', 50);
    // l1: duty 1000, vat 1980 ; l2: duty 0, vat 900
    expect(t.totalCustomsValue).toBe(15000);
    expect(t.totalDuty).toBe(1000);
    expect(t.totalImportVat).toBe(2880);
    expect(t.customsFee).toBe(50);
    expect(t.totalPayable).toBe(1000 + 0 + 2880 + 50);
  });
});

describe('transaction customs value', () => {
  it('goods + freight + insurance + additions', () => {
    expect(transactionCustomsValue(10000, 800, 200, 100)).toBe(11100);
  });
});
