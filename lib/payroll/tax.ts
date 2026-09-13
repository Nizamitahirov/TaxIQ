import type { PayrollLine, PayrollTaxConfig } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * AZ 2026 ilkin seed dəyərləri (10 §6.1).
 * ⚠️ Bu rəqəmlər tez-tez dəyişir — istehsalatdan əvvəl taxes.gov.az / DSMF-dən
 * TƏSDİQLƏNMƏLİDİR. Dəyərlər kodda sabit deyil, konfiqurasiya kimi saxlanılır və
 * HR/Mühasibat admini yeni versiya əlavə edə bilər (payrollTaxConfigs kolleksiyası).
 */
export const DEFAULT_TAX_CONFIG: PayrollTaxConfig = {
  id: 'default',
  effectiveFrom: '2026-01-01',
  effectiveTo: null,
  minimumWage: 400,
  // Qeyri-neft özəl sektor mütərəqqi gəlir vergisi (təsdiqlənməlidir)
  incomeTaxBrackets: [
    { uptoAmount: 2500, rate: 0.14, fixedAmount: 0 },
    { uptoAmount: null, rate: 0.25, fixedAmount: 350 }, // 14% × 2500 = 350
  ],
  socialInsurance: { employeeBaseRate: 0.03, employeeBaseThreshold: 200, employeeRateAboveThreshold: 0.10, employerRate: 0.22 },
  medicalInsurance: { employeeRateLowerBand: 0.02, lowerBandThreshold: 2500, employeeRateUpperBand: 0.005, employerRateLowerBand: 0.02, employerRateUpperBand: 0.005 },
  unemploymentInsurance: { employeeRate: 0.005, employerRate: 0.005 },
  notes: 'AZ 2026 ilkin seed — taxes.gov.az/DSMF-dən təsdiqlənməlidir',
};

function incomeTax(gross: number, cfg: PayrollTaxConfig): number {
  const brackets = cfg.incomeTaxBrackets;
  for (const b of brackets) {
    if (b.uptoAmount == null || gross <= b.uptoAmount) {
      const base = brackets.indexOf(b) === 0 ? 0 : (brackets[brackets.indexOf(b) - 1].uptoAmount ?? 0);
      return round2(b.fixedAmount + (gross - base) * b.rate);
    }
  }
  return 0;
}

function socialEmployee(gross: number, cfg: PayrollTaxConfig): number {
  const s = cfg.socialInsurance;
  if (gross <= s.employeeBaseThreshold) return round2(gross * s.employeeBaseRate);
  return round2(s.employeeBaseThreshold * s.employeeBaseRate + (gross - s.employeeBaseThreshold) * s.employeeRateAboveThreshold);
}

function medicalEmployee(gross: number, cfg: PayrollTaxConfig): number {
  const m = cfg.medicalInsurance;
  if (gross <= m.lowerBandThreshold) return round2(gross * m.employeeRateLowerBand);
  return round2(m.lowerBandThreshold * m.employeeRateLowerBand + (gross - m.lowerBandThreshold) * m.employeeRateUpperBand);
}

export interface PayrollInput { employeeId: string; employeeName: string; baseSalary: number; overtimePay?: number; bonuses?: number; otherDeductions?: number }

/** Bir işçi üçün tam əmək haqqı hesablanması (10 §6.3) */
export function calcPayrollLine(input: PayrollInput, cfg: PayrollTaxConfig): PayrollLine {
  const overtimePay = round2(input.overtimePay ?? 0);
  const bonuses = round2(input.bonuses ?? 0);
  const otherDeductions = round2(input.otherDeductions ?? 0);
  const grossSalary = round2(input.baseSalary + overtimePay + bonuses);

  const tax = incomeTax(grossSalary, cfg);
  const social = socialEmployee(grossSalary, cfg);
  const medical = medicalEmployee(grossSalary, cfg);
  const unemployment = round2(grossSalary * cfg.unemploymentInsurance.employeeRate);
  const netSalary = round2(grossSalary - tax - social - medical - unemployment - otherDeductions);

  const erSocial = round2(grossSalary * cfg.socialInsurance.employerRate);
  const erMedical = round2(grossSalary * (grossSalary <= cfg.medicalInsurance.lowerBandThreshold ? cfg.medicalInsurance.employerRateLowerBand : cfg.medicalInsurance.employerRateUpperBand));
  const erUnemployment = round2(grossSalary * cfg.unemploymentInsurance.employerRate);

  return {
    employeeId: input.employeeId, employeeName: input.employeeName,
    baseSalary: round2(input.baseSalary), overtimePay, bonuses, otherDeductions,
    grossSalary, incomeTax: tax, employeeSocialInsurance: social, employeeMedicalInsurance: medical,
    employeeUnemploymentInsurance: unemployment, netSalary,
    employerSocialInsurance: erSocial, employerMedicalInsurance: erMedical, employerUnemploymentInsurance: erUnemployment,
    totalEmployerCost: round2(grossSalary + erSocial + erMedical + erUnemployment),
  };
}
