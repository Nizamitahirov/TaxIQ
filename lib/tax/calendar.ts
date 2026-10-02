/**
 * Vergi təqvimi — bəyannamə və ödəniş son tarixləri.
 * Azərbaycan Respublikasının Vergi Məcəlləsi (m.149, 151, 166, 174, 201, 209, 221).
 *
 * Son tarixlər konfiqurasiya kimi saxlanılır (AZ_TAX_DEADLINES) və
 * istehsalatdan əvvəl taxes.gov.az vergi təqvimi ilə təsdiqlənməlidir.
 */

export type TaxKind = 'vat' | 'withholding' | 'profit' | 'simplified' | 'property' | 'property_advance' | 'land';
export type Frequency = 'monthly' | 'quarterly' | 'annual';

export interface TaxObligationDef {
  kind: TaxKind;
  name: { az: string; en: string };
  frequency: Frequency;
  /** ödəniş/bəyannamə son tarixi — ayın günü */
  dayOfMonth: number;
  /** illik öhdəliklər üçün ay (1–12) */
  month?: number;
  reference: string; // qanun maddəsi
}

/** Vergi öhdəlikləri kataloqu */
export const AZ_TAX_DEADLINES: Record<TaxKind, TaxObligationDef> = {
  vat: { kind: 'vat', name: { az: 'ƏDV bəyannaməsi və ödənişi', en: 'VAT return & payment' }, frequency: 'monthly', dayOfMonth: 20, reference: 'm.174/177' },
  withholding: { kind: 'withholding', name: { az: 'Muzdlu işlə əlaqədar gəlir vergisi (ödəmə mənbəyi)', en: 'Payroll withholding' }, frequency: 'monthly', dayOfMonth: 20, reference: 'm.150' },
  simplified: { kind: 'simplified', name: { az: 'Sadələşdirilmiş vergi bəyannaməsi', en: 'Simplified-tax return' }, frequency: 'quarterly', dayOfMonth: 20, reference: 'm.221' },
  profit: { kind: 'profit', name: { az: 'Mənfəət vergisi bəyannaməsi (illik)', en: 'Profit-tax return (annual)' }, frequency: 'annual', dayOfMonth: 31, month: 3, reference: 'm.149.2' },
  property: { kind: 'property', name: { az: 'Əmlak vergisi bəyannaməsi (illik)', en: 'Property-tax return (annual)' }, frequency: 'annual', dayOfMonth: 31, month: 3, reference: 'm.201.1' },
  property_advance: { kind: 'property_advance', name: { az: 'Əmlak vergisi — rüblük cari ödəniş', en: 'Property-tax quarterly advance' }, frequency: 'quarterly', dayOfMonth: 15, reference: 'm.201.3' },
  land: { kind: 'land', name: { az: 'Torpaq vergisi bəyannaməsi (illik)', en: 'Land-tax return (annual)' }, frequency: 'annual', dayOfMonth: 15, month: 5, reference: 'm.209' },
};

export interface CompanyTaxProfile {
  vatPayer?: boolean;
  simplifiedPayer?: boolean;   // true → sadələşdirilmiş (mənfəət/ƏDV yox)
  hasEmployees?: boolean;
  ownsProperty?: boolean;
  ownsLand?: boolean;
}

export interface TaxDeadline {
  kind: TaxKind;
  name: { az: string; en: string };
  dueDate: string;   // YYYY-MM-DD
  periodLabel: string;
  reference: string;
  daysUntil: number;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const QUARTER_SECOND_MONTH = [2, 5, 8, 11]; // rübün ikinci ayı (m.201.3)

/** Verilmiş öhdəlik üçün `from` tarixindən sonrakı ilk son tarix */
function nextDueFor(def: TaxObligationDef, from: Date): { due: Date; periodLabel: string } {
  const y = from.getFullYear();
  if (def.frequency === 'monthly') {
    // hesabat dövrü = əvvəlki ay; son tarix = cari/növbəti ayın `dayOfMonth`
    let due = new Date(y, from.getMonth(), def.dayOfMonth);
    if (due < from) due = new Date(y, from.getMonth() + 1, def.dayOfMonth);
    const period = new Date(due.getFullYear(), due.getMonth() - 1, 1);
    return { due, periodLabel: `${period.getFullYear()}-${String(period.getMonth() + 1).padStart(2, '0')}` };
  }
  if (def.frequency === 'quarterly') {
    const day = def.dayOfMonth;
    const candidates = (def.kind === 'property_advance' ? QUARTER_SECOND_MONTH : [3, 6, 9, 12]).map((m) => new Date(y, m - 1, day));
    candidates.push(...(def.kind === 'property_advance' ? QUARTER_SECOND_MONTH : [3, 6, 9, 12]).map((m) => new Date(y + 1, m - 1, day)));
    const due = candidates.find((d) => d >= from)!;
    const q = Math.floor(due.getMonth() / 3) + 1;
    return { due, periodLabel: `${due.getFullYear()} Q${def.kind === 'property_advance' ? q : q}` };
  }
  // annual
  let due = new Date(y, (def.month ?? 1) - 1, def.dayOfMonth);
  if (due < from) due = new Date(y + 1, (def.month ?? 1) - 1, def.dayOfMonth);
  return { due, periodLabel: `${due.getFullYear() - 1}` };
}

/** Şirkət profilinə görə aktiv vergi öhdəlikləri */
export function obligationsFor(profile: CompanyTaxProfile): TaxKind[] {
  const out: TaxKind[] = [];
  if (profile.simplifiedPayer) {
    out.push('simplified');
  } else {
    if (profile.vatPayer) out.push('vat');
    out.push('profit');
  }
  if (profile.hasEmployees) out.push('withholding');
  if (profile.ownsProperty) { out.push('property', 'property_advance'); }
  if (profile.ownsLand) out.push('land');
  return out;
}

/**
 * Şirkət üçün yaxınlaşan vergi son tarixləri (tarixə görə artan).
 * @param monthsAhead neçə ay irəli (default 6) — rüblük/illik üçün də tutulur
 */
export function upcomingDeadlines(profile: CompanyTaxProfile, from: Date = new Date(), monthsAhead = 6): TaxDeadline[] {
  const horizon = new Date(from); horizon.setMonth(horizon.getMonth() + monthsAhead);
  const kinds = obligationsFor(profile);
  const out: TaxDeadline[] = [];
  for (const kind of kinds) {
    const def = AZ_TAX_DEADLINES[kind];
    let cursor = new Date(from);
    // bütün üfüqdəki təkrarları çıxart
    for (let guard = 0; guard < 24; guard++) {
      const { due, periodLabel } = nextDueFor(def, cursor);
      if (due > horizon) break;
      out.push({
        kind, name: def.name, dueDate: iso(due), periodLabel, reference: def.reference,
        daysUntil: Math.ceil((due.getTime() - from.getTime()) / 86_400_000),
      });
      cursor = new Date(due.getTime() + 86_400_000); // növbəti dövrə keç
    }
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
