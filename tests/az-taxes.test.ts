import { describe, it, expect } from 'vitest';
import {
  AZ_TAX_RATES, vatPayable, vatFromGross, profitTax, profitAdvancePriorYear,
  simplifiedTax, microExemptionEligible, applyMicroExemption, withholdingTax,
  averageAnnualValue, propertyTax, propertyAdvance, landTax, thresholdStatus,
  latePaymentInterest, microDepreciationRate, repairExpenseCap,
} from '@/lib/tax/az-taxes';

describe('VAT — Tax Code Art.173-174', () => {
  it('rate is 18%', () => expect(AZ_TAX_RATES.vat).toBe(0.18));
  it('payable = output − creditable', () => {
    expect(vatPayable(10000, 900)).toBe(900); // 1800 − 900
  });
  it('splits VAT out of a gross amount', () => {
    const { net, vat } = vatFromGross(1180);
    expect(net).toBe(1000); expect(vat).toBe(180);
  });
});

describe('profit tax — Art.105/151', () => {
  it('20% of taxable profit, floored at 0', () => {
    expect(profitTax(50000)).toBe(10000);
    expect(profitTax(-5000)).toBe(0);
  });
  it('prior-year quarterly advance = tax/4', () => {
    expect(profitAdvancePriorYear(8000)).toBe(2000);
  });
});

describe('simplified tax — Art.220', () => {
  it('general 2%, trade 6%, catering 8%', () => {
    expect(simplifiedTax(100000)).toBe(2000);
    expect(simplifiedTax(100000, 'trade')).toBe(6000);
    expect(simplifiedTax(100000, 'catering')).toBe(8000);
  });
});

describe('micro exemption — Art.102.1.30 / 106.1.20', () => {
  it('needs ≥3 employees and no social debt', () => {
    expect(microExemptionEligible(3, false)).toBe(true);
    expect(microExemptionEligible(2, false)).toBe(false);
    expect(microExemptionEligible(5, true)).toBe(false);
  });
  it('applies 75% exemption when eligible', () => {
    const r = applyMicroExemption(10000, true);
    expect(r.exemption).toBe(7500);
    expect(r.taxAfter).toBe(2500);
  });
  it('no exemption when ineligible', () => {
    expect(applyMicroExemption(10000, false).taxAfter).toBe(10000);
  });
});

describe('withholding — Art.122-125', () => {
  it('dividend 5%, interest 10%, rent 14%, lease 4%', () => {
    expect(withholdingTax(1000, 'dividend').tax).toBe(50);
    expect(withholdingTax(1000, 'interest').tax).toBe(100);
    expect(withholdingTax(1000, 'rentCommercial').tax).toBe(140);
    expect(withholdingTax(1000, 'leaseInsurance').tax).toBe(40);
  });
  it('returns the net after withholding', () => {
    expect(withholdingTax(1000, 'dividend').net).toBe(950);
  });
});

describe('property tax — Art.199-201', () => {
  it('average annual value = (opening + closing) / 2', () => {
    expect(averageAnnualValue(100000, 80000)).toBe(90000);
  });
  it('1% of average annual value', () => {
    expect(propertyTax(90000)).toBe(900);
  });
  it('quarterly advance = 20% of prior-year tax', () => {
    expect(propertyAdvance(900)).toBe(180);
  });
});

describe('land tax — Art.206', () => {
  it('area × tariff', () => expect(landTax(1000, 0.06)).toBe(60));
});

describe('thresholds — Art.155/218', () => {
  it('flags VAT registration above 200k', () => {
    const s = thresholdStatus(250000);
    expect(s.vatRegistrationRequired).toBe(true);
    expect(s.simplifiedEligible).toBe(false);
    expect(s.headroom).toBe(-50000);
  });
  it('simplified eligible at or below 200k', () => {
    expect(thresholdStatus(150000).simplifiedEligible).toBe(true);
  });
});

describe('penalties & depreciation — Art.59 / 114-115', () => {
  it('late interest 0.1%/day capped at 365 days', () => {
    expect(latePaymentInterest(10000, 30)).toBe(300);
    expect(latePaymentInterest(10000, 500)).toBe(latePaymentInterest(10000, 365));
  });
  it('micro depreciation doubles the rate (capped 100)', () => {
    expect(microDepreciationRate(20)).toBe(40);
    expect(microDepreciationRate(60)).toBe(100);
  });
  it('repair cap by category', () => {
    expect(repairExpenseCap('buildings', 100000)).toBe(2000);
    expect(repairExpenseCap('trucks', 100000)).toBe(8000);
    expect(repairExpenseCap('other', 100000)).toBe(3000);
  });
});
