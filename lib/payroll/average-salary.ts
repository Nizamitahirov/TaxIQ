/**
 * Orta əmək haqqı mühərriki — Azərbaycan Respublikasının Əmək Məcəlləsi.
 *
 * İki ayrı orta hesablama qaydası var:
 *  • Məzuniyyət pulu (m.140.3): məzuniyyətdən əvvəlki 12 təqvim ayının
 *    cəmi ÷ 12 = orta aylıq → ÷ 30,4 (ayın təqvim günlərinin orta illik
 *    miqdarı) = bir günlük → × məzuniyyətin təqvim günləri.
 *  • Qalan bütün hallar (m.177.2): ödənişdən əvvəlki 2 təqvim ayının cəmi
 *    ÷ həmin aylardakı iş günləri = bir günlük → × saxlanılan iş günləri.
 *
 * Bütün dərəcələr/əmsallar konfiqurasiya kimi saxlanılır (AZ_LABOUR_RULES)
 * və istehsalatdan əvvəl təsdiqlənməlidir.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Ayın təqvim günlərinin orta illik miqdarı (m.140.3) */
export const AVG_CALENDAR_DAYS_PER_MONTH = 30.4;

/** Bir ayda qazanılan əmək haqqı (m.139 / m.154.1 — bütün növ ödəmələr, birdəfəlik istisna) */
export interface MonthEarning {
  /** YYYY-MM */
  month: string;
  /** həmin ayın əmək haqqı cəmi (maaş + əlavə + mükafat), birdəfəlik ödənişlər istisna */
  earnings: number;
  /** həmin ayın iş günləri (m.177.2 üçün) */
  workdays?: number;
  /** ay tam işlənibmi — qismən sosial/ödənişsiz məzuniyyət, boşdayanma aylarını əvəz etmək üçün (m.140.1) */
  fullyWorked?: boolean;
}

/**
 * Məzuniyyət pulu üçün bir günlük orta əmək haqqı (m.140.3).
 * 12 aydan az işləyibsə faktiki tam işlənmiş aylara əsasən (m.140.2).
 * Tam işlənməyən aylar nəzərə alınmır (yaxın tam aylarla əvəz edilir — m.140.1).
 */
export function dailyAverageForLeave(months: MonthEarning[]): number {
  const usable = months.filter((m) => m.fullyWorked !== false && m.earnings > 0);
  if (usable.length === 0) return 0;
  const count = Math.min(usable.length, 12);
  const recent = usable.slice(-count);
  const total = recent.reduce((s, m) => s + m.earnings, 0);
  const avgMonthly = total / count;
  return round2(avgMonthly / AVG_CALENDAR_DAYS_PER_MONTH);
}

/** Orta aylıq əmək haqqı (m.140 bazası) — xitam müavinəti və s. üçün */
export function averageMonthlyWage(months: MonthEarning[]): number {
  const usable = months.filter((m) => m.fullyWorked !== false && m.earnings > 0);
  if (usable.length === 0) return 0;
  const count = Math.min(usable.length, 12);
  const recent = usable.slice(-count);
  return round2(recent.reduce((s, m) => s + m.earnings, 0) / count);
}

/**
 * Məzuniyyət pulu (m.140.3) və istifadə edilməmiş məzuniyyətə görə
 * kompensasiya (m.140.4) — eyni qayda.
 * @param calendarDays məzuniyyətin təqvim günləri
 */
export function calcLeavePay(months: MonthEarning[], calendarDays: number): { daily: number; total: number } {
  const daily = dailyAverageForLeave(months);
  return { daily, total: round2(daily * calendarDays) };
}

/**
 * Qalan hallar üçün bir günlük orta əmək haqqı (m.177.2):
 * 2 təqvim ayının cəmi ÷ həmin aylardakı iş günləri.
 * 2 aydan az işləyibsə faktiki işlənmiş günlərə əsasən (m.177.3).
 * @param lastDaily sonuncu bir günlük əmək haqqı — m.177.3-1 (hesablanan < sonuncu olduqda)
 */
export function dailyAverageGeneral(months: MonthEarning[], lastDaily?: number): number {
  const recent = months.slice(-2);
  const totalEarnings = recent.reduce((s, m) => s + m.earnings, 0);
  const totalWorkdays = recent.reduce((s, m) => s + (m.workdays ?? 0), 0);
  if (totalWorkdays <= 0) return round2(lastDaily ?? 0);
  const daily = round2(totalEarnings / totalWorkdays);
  if (lastDaily != null && daily < lastDaily) return round2(lastDaily); // m.177.3-1
  return daily;
}

/** Saxlanılan iş günləri üçün orta əmək haqqı (ezamiyyət və s. — m.177.2) */
export function calcGeneralAverage(months: MonthEarning[], preservedWorkdays: number, lastDaily?: number): { daily: number; total: number } {
  const daily = dailyAverageGeneral(months, lastDaily);
  return { daily, total: round2(daily * preservedWorkdays) };
}

// ──────────────────────────────────────────────────────────────
//  Əlavə məzuniyyət günləri (m.115–119)
// ──────────────────────────────────────────────────────────────

/** Əsas məzuniyyət kateqoriyaları (m.114) */
export type BasicLeaveCategory = 'standard' | 'extended30' | 'pedagogical56' | 'pedagogical42' | 'physio42' | 'physio35' | 'special46' | 'theatre42' | 'theatre35';

export const BASIC_LEAVE_DAYS: Record<BasicLeaveCategory, number> = {
  standard: 21,       // m.114.2 — ümumi minimum
  extended30: 30,     // m.114.3 — k/t, dövlət qulluqçuları, həkim/müəllim rəhbərləri və s.
  pedagogical56: 56,  // m.118.1 — müəllimlər, elmlər doktoru və s.
  pedagogical42: 42,  // m.118.2 — məktəbəqədər, fəlsəfə doktoru və s.
  physio42: 42,       // m.119 — 16 yaşadək, əlilliyi olan 18 yaşadək
  physio35: 35,       // m.119 — 16–18 yaş
  special46: 46,      // m.120 — xüsusi xidmətləri olanlar
  theatre42: 42,      // m.121 — teatr bədii/artist heyəti
  theatre35: 35,      // m.121 — səhnəyə xidmət edənlər
};

/**
 * Əmək stajına görə əlavə məzuniyyət (m.116.1):
 *  5–10 il → 2; 10–15 il → 4; 15+ il → 6 təqvim günü.
 */
export function seniorityLeaveDays(serviceYears: number): number {
  if (serviceYears >= 15) return 6;
  if (serviceYears >= 10) return 4;
  if (serviceYears >= 5) return 2;
  return 0;
}

/**
 * Uşaqlı qadınların (və tək ata/övladlığa götürənlərin) əlavə məzuniyyəti (m.117.1):
 *  14 yaşadək 2 uşaq → 2; 3+ uşaq və ya əlilliyi olan uşaq → 5 təqvim günü.
 */
export function childcareLeaveDays(childrenUnder14: number, hasDisabledChild: boolean): number {
  if (hasDisabledChild || childrenUnder14 >= 3) return 5;
  if (childrenUnder14 >= 2) return 2;
  return 0;
}

export interface AdditionalLeaveInput {
  serviceYears: number;
  /** m.115 — zərərli/ağır əmək şəraiti (siyahı icra hakimiyyəti ilə; min 6 gün) */
  hazardousDays?: number;
  childrenUnder14?: number;
  hasDisabledChild?: boolean;
  /** m.118-1 — işğaldan azad edilmiş ərazilərdə işləyən mütəxəssis (+5 gün) */
  liberatedTerritory?: boolean;
  /** m.116.3 — pedaqoji/elmi (m.118–121) işçilərə staj/şərait əlavəsi verilmir */
  excludeSeniority?: boolean;
}

/** m.115–119 üzrə əlavə məzuniyyət günlərinin bölünməsi */
export function additionalLeaveBreakdown(input: AdditionalLeaveInput): { label: string; days: number }[] {
  const out: { label: string; days: number }[] = [];
  if (!input.excludeSeniority) {
    const s = seniorityLeaveDays(input.serviceYears);
    if (s) out.push({ label: 'Əmək stajına görə (m.116)', days: s });
  }
  if (input.hazardousDays && input.hazardousDays > 0) {
    out.push({ label: 'Əmək şəraitinə görə (m.115)', days: input.hazardousDays });
  }
  if (!input.excludeSeniority) {
    const c = childcareLeaveDays(input.childrenUnder14 ?? 0, !!input.hasDisabledChild);
    if (c) out.push({ label: 'Uşaqlı valideynə (m.117)', days: c });
  }
  if (input.liberatedTerritory) {
    out.push({ label: 'İşğaldan azad ərazi (m.118-1)', days: 5 });
  }
  return out;
}

/** Cəmi məzuniyyət günləri (əsas + əlavə) */
export function totalLeaveEntitlement(basic: BasicLeaveCategory, add: AdditionalLeaveInput): { basicDays: number; additional: { label: string; days: number }[]; totalDays: number } {
  const basicDays = BASIC_LEAVE_DAYS[basic];
  const additional = additionalLeaveBreakdown(add);
  const totalDays = basicDays + additional.reduce((s, a) => s + a.days, 0);
  return { basicDays, additional, totalDays };
}

// ──────────────────────────────────────────────────────────────
//  İş vaxtından artıq / gecə / bayram üstəlikləri (m.164–166)
// ──────────────────────────────────────────────────────────────

/** Əmək Məcəlləsi üstəlik əmsalları (konfiqurasiya) */
export const AZ_LABOUR_RULES = {
  overtimeMultiplier: 2,     // m.165.1 — ən azı ikiqat saatlıq tarif
  holidayMultiplier: 2,      // m.164.1 — istirahət/bayram ən azı ikiqat
  nightPremiumRate: 0.2,     // m.166 — gecə işi üstəliyi (icra hakimiyyəti həddi; default +20%)
  nightStartHour: 22,        // m.97 — gecə vaxtı 22:00–06:00
  nightEndHour: 6,
  weeklyHoursNorm: 40,       // m.89 — həftəlik normal iş vaxtı
  dailyHoursNorm: 8,
};

/** Aylıq maaşdan saatlıq tarif (ay norması saatları ilə) */
export function hourlyRate(monthlySalary: number, monthlyNormHours: number): number {
  if (monthlyNormHours <= 0) return 0;
  return round2(monthlySalary / monthlyNormHours);
}

/** İş vaxtından artıq haqq (m.165.1) — hər saat ≥ ikiqat saatlıq tarif */
export function overtimePay(hours: number, hourly: number, multiplier = AZ_LABOUR_RULES.overtimeMultiplier): number {
  return round2(hours * hourly * multiplier);
}

/** İstirahət/bayram günü işi (m.164.1) — ≥ ikiqat */
export function holidayWorkPay(hours: number, hourly: number, multiplier = AZ_LABOUR_RULES.holidayMultiplier): number {
  return round2(hours * hourly * multiplier);
}

/** Gecə işi üstəliyi (m.166) — adi haqdan əlavə */
export function nightPremium(nightHours: number, hourly: number, rate = AZ_LABOUR_RULES.nightPremiumRate): number {
  return round2(nightHours * hourly * rate);
}

// ──────────────────────────────────────────────────────────────
//  Əmək müqaviləsinə xitam — xəbərdarlıq və müavinət (m.77)
// ──────────────────────────────────────────────────────────────

/** Xəbərdarlıq müddəti — təqvim həftəsi (m.77.1, ştat ixtisarı) */
export function noticeWeeks(serviceYears: number): number {
  if (serviceYears > 10) return 9;
  if (serviceYears >= 5) return 6;
  if (serviceYears >= 1) return 4;
  return 2;
}

/** İşdənçıxma müavinəti əmsalı — orta aylıq əmək haqqının misli (m.77.3) */
export function severanceMultiplier(serviceYears: number): number {
  if (serviceYears > 10) return 2;
  if (serviceYears >= 5) return 1.7;
  if (serviceYears >= 1) return 1.4;
  return 1;
}

export type SeveranceKind =
  | 'redundancy'   // m.77.3 — say azaldılması / ştat ixtisarı (m.70 "a","b")
  | 'special2x'    // m.77.7 — m.68.2.c, 74.1.a/c → ≥ 2 misli
  | 'special3x'    // m.77.7 — m.68.2.ç, 74.1.a → ≥ 3 misli
  | 'death';       // m.77.7 — vəfat → vərəsələrə ≥ 3 misli

/**
 * İşdənçıxma müavinəti (m.77).
 * @param averageMonthly orta aylıq əmək haqqı (averageMonthlyWage ilə)
 * @param serviceYears   müəssisədəki əmək stajı
 */
export function severancePay(averageMonthly: number, serviceYears: number, kind: SeveranceKind = 'redundancy'): { multiplier: number; amount: number } {
  let multiplier: number;
  switch (kind) {
    case 'special2x': multiplier = 2; break;
    case 'special3x':
    case 'death': multiplier = 3; break;
    default: multiplier = severanceMultiplier(serviceYears);
  }
  return { multiplier, amount: round2(averageMonthly * multiplier) };
}

/** Minimum əmək haqqı yoxlaması (m.155.3) */
export function belowMinimumWage(monthlySalary: number, minimumWage: number): boolean {
  return monthlySalary < minimumWage;
}

/** İl + ay → faktiki təqvim stajı (il, ondalıq) */
export function serviceYearsBetween(hireDate: string, asOf: string | Date = new Date()): number {
  const start = new Date(hireDate).getTime();
  const end = (asOf instanceof Date ? asOf : new Date(asOf)).getTime();
  if (!isFinite(start) || !isFinite(end) || end <= start) return 0;
  return (end - start) / (365.25 * 86_400_000);
}
