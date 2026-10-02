/**
 * Azərbaycan Respublikasının Vergi Məcəlləsi — vergi hesablama mühərriki.
 *
 * Bütün dərəcələr qanun mətnindən götürülüb (maddə nömrələri qeyd olunub),
 * lakin tez-tez dəyişdiyi üçün `AZ_TAX_RATES` konfiqurasiya kimi saxlanılır
 * və istehsalatdan əvvəl taxes.gov.az-dan təsdiqlənməlidir.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

export const AZ_TAX_RATES = {
  vat: 0.18,                       // m.173.1 — ƏDV 18%
  profit: 0.20,                    // m.105.1 — mənfəət vergisi 20%
  individualEntrepreneur: 0.20,    // m.101.3 — hüquqi şəxs yaratmadan sahibkar 20%
  nonBusinessIncome: 0.14,         // m.101.2 — qeyri-sahibkarlıq illik gəlir 14%
  simplified: 0.02,                // m.220.1 — sadələşdirilmiş ümumi 2%
  simplifiedTrade: 0.06,           // m.220.1-1.1 — ticarət 6%
  simplifiedCatering: 0.08,        // m.220.1-1.2 — ictimai iaşə 8%
  withholding: {
    dividend: 0.05,                // m.122.1 — dividend 5%
    interest: 0.10,                // m.123.1 — faiz 10%
    rentCommercial: 0.14,          // m.124.1 — icarə (daşınan/daşınmaz əmlak) 14%
    rentResidential: 0.10,         // m.124 — kirayə (yaşayış) 10%
    royalty: 0.14,                 // m.124.1 — royalti 14%
    leaseInsurance: 0.04,          // m.125.1.3 — lizinq/sığorta 4%
  },
  property: 0.01,                  // m.198/199 — hüquqi şəxs əsas vəsaitləri 1% (orta illik qalıq dəyər)
  propertyAdvanceRate: 0.20,       // m.201.3 — rüblük cari ödəniş əvvəlki ilin 20%-i
  profitAdvanceRate: 0.20,         // rüblük mənfəət avansı (əvvəlki il metodu) 20%
  penaltyPerDay: 0.001,            // m.59.1 — gecikmə faizi 0.1%/gün
  vatRegistrationThreshold: 200_000, // m.155 — ardıcıl 12 ay / ƏDV məcburi qeydiyyat
  simplifiedThreshold: 200_000,    // m.218 — sadələşdirilmiş rejim 12 aylıq hədd
  microEmployeeMinimum: 3,         // m.102.1.30/106.1.20 — mikro güzəşt üçün min işçi sayı
  microExemptionRate: 0.75,        // mikro sahibkar mənfəət/gəlir 75% azadolma
  microDepreciationCoefficient: 2, // m.114.3-2 — mikro əsas vəsait amortizasiya ×2
};

// ── ƏDV (m.173-174) ──────────────────────────────────────────
/** Vergi tutulan dövriyyədən ƏDV (çıxarılır: əvəzləşdirilən ƏDV) — m.174.1 */
export function vatPayable(taxableTurnover: number, creditableVat: number, rate = AZ_TAX_RATES.vat): number {
  const output = round2(taxableTurnover * rate);
  return round2(output - creditableVat);
}
/** Qiymətə daxil ƏDV-nin ayrılması (brüto → net + ƏDV) */
export function vatFromGross(gross: number, rate = AZ_TAX_RATES.vat): { net: number; vat: number } {
  const net = round2(gross / (1 + rate));
  return { net, vat: round2(gross - net) };
}

// ── Mənfəət vergisi (m.105) + rüblük avans (m.151) ───────────
export function profitTax(taxableProfit: number, rate = AZ_TAX_RATES.profit): number {
  return round2(Math.max(0, taxableProfit) * rate);
}
/**
 * Rüblük cari (avans) mənfəət ödənişi (m.151.1).
 * Metod A — əvvəlki ilin vergisinin 1/4-i; Metod B — cari rüb dövriyyəsi × keçən il əmsalı.
 */
export function profitAdvancePriorYear(priorYearProfitTax: number): number {
  return round2(priorYearProfitTax / 4);
}
export function profitAdvanceCurrentTurnover(quarterTurnover: number, priorYearEffectiveRate: number): number {
  return round2(quarterTurnover * priorYearEffectiveRate);
}

// ── Sadələşdirilmiş vergi (m.218-220) ────────────────────────
export type SimplifiedKind = 'general' | 'trade' | 'catering';
export function simplifiedTax(turnover: number, kind: SimplifiedKind = 'general'): number {
  const rate = kind === 'trade' ? AZ_TAX_RATES.simplifiedTrade
    : kind === 'catering' ? AZ_TAX_RATES.simplifiedCatering
    : AZ_TAX_RATES.simplified;
  return round2(Math.max(0, turnover) * rate);
}

// ── Mikro/kiçik sahibkar güzəşti (m.102.1.30 / 106.1.20) ─────
/** Mikro sahibkar şərtləri: orta aylıq işçi ≥ 3 və DSMF borcu yoxdur → 75% azadolma */
export function microExemptionEligible(avgMonthlyEmployees: number, hasSocialDebt: boolean): boolean {
  return avgMonthlyEmployees >= AZ_TAX_RATES.microEmployeeMinimum && !hasSocialDebt;
}
/** Mikro güzəşti tətbiq olunmuş mənfəət/gəlir vergisi */
export function applyMicroExemption(taxBeforeExemption: number, eligible: boolean): { exemption: number; taxAfter: number } {
  if (!eligible) return { exemption: 0, taxAfter: round2(taxBeforeExemption) };
  const exemption = round2(taxBeforeExemption * AZ_TAX_RATES.microExemptionRate);
  return { exemption, taxAfter: round2(taxBeforeExemption - exemption) };
}

// ── Ödəmə mənbəyində vergi / withholding (m.122-125) ─────────
export type WithholdingKind = keyof typeof AZ_TAX_RATES.withholding;
export function withholdingTax(amount: number, kind: WithholdingKind): { rate: number; tax: number; net: number } {
  const rate = AZ_TAX_RATES.withholding[kind];
  const tax = round2(amount * rate);
  return { rate, tax, net: round2(amount - tax) };
}

// ── Əmlak vergisi (m.197-201) ────────────────────────────────
/** Orta illik qalıq dəyər = (il əvvəli + il sonu) / 2 */
export function averageAnnualValue(openingResidual: number, closingResidual: number): number {
  return round2((openingResidual + closingResidual) / 2);
}
/** İllik əmlak vergisi (hüquqi şəxs əsas vəsaitləri) — m.199, 1% */
export function propertyTax(averageAnnual: number, rate = AZ_TAX_RATES.property): number {
  return round2(averageAnnual * rate);
}
/** Rüblük cari əmlak ödənişi — əvvəlki il vergisinin 20%-i (m.201.3) */
export function propertyAdvance(priorYearPropertyTax: number): number {
  return round2(priorYearPropertyTax * AZ_TAX_RATES.propertyAdvanceRate);
}

// ── Torpaq vergisi (m.206-210) ───────────────────────────────
/** Torpaq vergisi = sahə (m²/ha) × zona/kateqoriya tarifi (konfiqurasiya) */
export function landTax(areaUnits: number, tariffPerUnit: number): number {
  return round2(Math.max(0, areaUnits) * Math.max(0, tariffPerUnit));
}

// ── ƏDV qeydiyyatı / sadələşdirilmiş hədd izləmə (m.155, 218) ─
export interface ThresholdStatus {
  rolling12mTurnover: number;
  vatRegistrationRequired: boolean;   // > 200.000 → ƏDV məcburi
  simplifiedEligible: boolean;        // ≤ 200.000 → sadələşdirilmiş mümkün
  headroom: number;                   // hədədək qalan məbləğ
}
export function thresholdStatus(rolling12mTurnover: number): ThresholdStatus {
  const t = AZ_TAX_RATES.vatRegistrationThreshold;
  return {
    rolling12mTurnover: round2(rolling12mTurnover),
    vatRegistrationRequired: rolling12mTurnover > t,
    simplifiedEligible: rolling12mTurnover <= AZ_TAX_RATES.simplifiedThreshold,
    headroom: round2(t - rolling12mTurnover),
  };
}

// ── Cərimə / faiz (m.57-59) ──────────────────────────────────
/** Gecikmə faizi — ödənilməmiş məbləğ × 0.1% × gün (m.59.1), maksimum 1 il (365 gün) */
export function latePaymentInterest(unpaidAmount: number, daysLate: number, ratePerDay = AZ_TAX_RATES.penaltyPerDay): number {
  const days = Math.min(Math.max(0, daysLate), 365);
  return round2(Math.max(0, unpaidAmount) * ratePerDay * days);
}

// ── Amortizasiya — mikro ×2 əmsalı (m.114.3-2) ──────────────
/** Mikro sahibkar üçün effektiv amortizasiya norması (2× məhdudiyyətlə) */
export function microDepreciationRate(baseRatePct: number): number {
  return Math.min(100, round2(baseRatePct * AZ_TAX_RATES.microDepreciationCoefficient));
}

// ── Təmir xərclərinin gəlirdən çıxılma həddi (m.115.1) ──────
/** Kateqoriyaya görə illik təmir xərci limiti (il sonu qalıq dəyərə görə %) */
export const REPAIR_CAP_PCT: Record<string, number> = {
  buildings: 2,        // m.114.3.1 kateqoriyası
  machinery: 5,        // m.114.3.2/2-1/3 (yük avtomobili istisna)
  computers: 5,
  vehicles: 5,
  trucks: 8,           // yük avtomobilləri
  other: 3,            // m.114.3.7
};
export function repairExpenseCap(categoryKey: string, yearEndResidual: number): number {
  const pct = REPAIR_CAP_PCT[categoryKey] ?? 3;
  return round2(yearEndResidual * (pct / 100));
}
