/**
 * Gömrük ödənişləri mühərriki — Azərbaycan Respublikasının Gömrük Məcəlləsi.
 *
 * İdxalda ödənişlər ardıcıllığı:
 *  1. Gömrük rüsumu = gömrük dəyəri × rüsum dərəcəsi
 *  2. Aksiz = gömrük dəyəri × aksiz dərəcəsi (aksizli mallar)
 *  3. İdxal ƏDV = (gömrük dəyəri + rüsum + aksiz) × 18%  (Vergi Məcəlləsi m.169)
 *  4. Gömrük yığımı (rəsmiləşdirmə haqqı) — konfiqurasiya
 *
 * Rüsum dərəcələri «Gömrük tarifi haqqında» Qanun + NK qərarları ilə müəyyən
 * olunur; burada sətir-sətir konfiqurasiya kimi daxil edilir.
 */
import type { CustomsLine, CustomsRegime } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

export const IMPORT_VAT_RATE = 0.18; // Vergi Məcəlləsi m.173

/** Bir sətir üzrə gömrük ödənişləri */
export function lineCharges(line: CustomsLine, regime: CustomsRegime): { duty: number; excise: number; importVat: number } {
  const value = Math.max(0, line.customsValue);
  // İxrac/tranzit/reeksportda idxal ƏDV və rüsum əksər hallarda tutulmur
  const dutiable = regime === 'import' || regime === 'temporary_import' || regime === 'warehouse';
  const duty = dutiable ? round2(value * (line.dutyRate / 100)) : 0;
  const excise = dutiable && line.exciseRate ? round2(value * (line.exciseRate / 100)) : 0;
  const vatBase = value + duty + excise;
  const importVat = dutiable && line.vatApplicable !== false ? round2(vatBase * IMPORT_VAT_RATE) : 0;
  return { duty, excise, importVat };
}

export interface CustomsTotals {
  totalCustomsValue: number;
  totalDuty: number;
  totalExcise: number;
  totalImportVat: number;
  customsFee: number;
  totalPayable: number;
}

/** Bütün sətirlər üzrə gömrük ödənişlərinin cəmi */
export function computeCustoms(lines: CustomsLine[], regime: CustomsRegime, customsFee = 0): CustomsTotals {
  let totalCustomsValue = 0, totalDuty = 0, totalExcise = 0, totalImportVat = 0;
  for (const l of lines) {
    totalCustomsValue += Math.max(0, l.customsValue);
    const c = lineCharges(l, regime);
    totalDuty += c.duty; totalExcise += c.excise; totalImportVat += c.importVat;
  }
  totalCustomsValue = round2(totalCustomsValue);
  totalDuty = round2(totalDuty);
  totalExcise = round2(totalExcise);
  totalImportVat = round2(totalImportVat);
  const fee = round2(Math.max(0, customsFee));
  const totalPayable = round2(totalDuty + totalExcise + totalImportVat + fee);
  return { totalCustomsValue, totalDuty, totalExcise, totalImportVat, customsFee: fee, totalPayable };
}

/**
 * Gömrük dəyəri (əməliyyat dəyəri metodu, Gömrük Məcəlləsi):
 * mal dəyəri + nəqliyyat (fraxt) + sığorta + digər əlavələr.
 */
export function transactionCustomsValue(goodsValue: number, freight = 0, insurance = 0, otherAdditions = 0): number {
  return round2(Math.max(0, goodsValue) + Math.max(0, freight) + Math.max(0, insurance) + Math.max(0, otherAdditions));
}

export const CUSTOMS_REGIMES: { value: CustomsRegime; az: string; en: string }[] = [
  { value: 'import', az: 'İdxal', en: 'Import' },
  { value: 'export', az: 'İxrac', en: 'Export' },
  { value: 'transit', az: 'Tranzit', en: 'Transit' },
  { value: 'temporary_import', az: 'Müvəqqəti idxal', en: 'Temporary import' },
  { value: 'warehouse', az: 'Gömrük anbarı', en: 'Customs warehouse' },
  { value: 'reexport', az: 'Reeksport', en: 'Re-export' },
];
