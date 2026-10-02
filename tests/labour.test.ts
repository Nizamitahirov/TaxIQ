import { describe, it, expect } from 'vitest';
import {
  dailyAverageForLeave, averageMonthlyWage, calcLeavePay, dailyAverageGeneral,
  seniorityLeaveDays, childcareLeaveDays, totalLeaveEntitlement, additionalLeaveBreakdown,
  overtimePay, holidayWorkPay, nightPremium, hourlyRate,
  noticeWeeks, severanceMultiplier, severancePay, belowMinimumWage, serviceYearsBetween,
  AVG_CALENDAR_DAYS_PER_MONTH, type MonthEarning,
} from '@/lib/payroll/average-salary';

const months12 = (v: number): MonthEarning[] =>
  Array.from({ length: 12 }, (_, i) => ({ month: `2025-${String(i + 1).padStart(2, '0')}`, earnings: v, workdays: 22, fullyWorked: true }));

describe('leave pay — Labour Code Art.140', () => {
  it('daily average = monthly / 30.4', () => {
    expect(dailyAverageForLeave(months12(1000))).toBeCloseTo(1000 / AVG_CALENDAR_DAYS_PER_MONTH, 2);
  });
  it('leave pay = daily × calendar days', () => {
    const { total } = calcLeavePay(months12(1216), 21);
    expect(total).toBeCloseTo((1216 / 30.4) * 21, 1); // 40 × 21 = 840
  });
  it('uses only fully-worked months (Art.140.1)', () => {
    const hist = months12(1000);
    hist[0] = { ...hist[0], fullyWorked: false, earnings: 0 };
    expect(dailyAverageForLeave(hist)).toBeCloseTo(1000 / 30.4, 2);
  });
  it('averageMonthlyWage averages the usable months', () => {
    expect(averageMonthlyWage(months12(900))).toBe(900);
  });
});

describe('general average — Labour Code Art.177', () => {
  it('2-month sum / workdays, × preserved workdays', () => {
    const hist: MonthEarning[] = [
      { month: '2025-08', earnings: 1100, workdays: 22 },
      { month: '2025-09', earnings: 1100, workdays: 22 },
    ];
    expect(dailyAverageGeneral(hist)).toBeCloseTo(2200 / 44, 2); // 50/day
  });
  it('applies last-daily floor (Art.177.3-1)', () => {
    const hist: MonthEarning[] = [
      { month: '2025-08', earnings: 440, workdays: 22 },
      { month: '2025-09', earnings: 440, workdays: 22 },
    ];
    expect(dailyAverageGeneral(hist, 60)).toBe(60); // computed 20 < last 60 → 60
  });
});

describe('additional leave days — Art.115-119', () => {
  it('seniority ladder (Art.116)', () => {
    expect(seniorityLeaveDays(3)).toBe(0);
    expect(seniorityLeaveDays(7)).toBe(2);
    expect(seniorityLeaveDays(12)).toBe(4);
    expect(seniorityLeaveDays(20)).toBe(6);
  });
  it('childcare (Art.117)', () => {
    expect(childcareLeaveDays(1, false)).toBe(0);
    expect(childcareLeaveDays(2, false)).toBe(2);
    expect(childcareLeaveDays(3, false)).toBe(5);
    expect(childcareLeaveDays(1, true)).toBe(5);
  });
  it('total entitlement sums basic + additional', () => {
    const r = totalLeaveEntitlement('standard', { serviceYears: 12, childrenUnder14: 2, liberatedTerritory: true });
    expect(r.basicDays).toBe(21);
    expect(r.totalDays).toBe(21 + 4 + 2 + 5); // staj 4 + children 2 + liberated 5
  });
  it('excludeSeniority drops staj & childcare (Art.116.3)', () => {
    const b = additionalLeaveBreakdown({ serviceYears: 20, childrenUnder14: 3, excludeSeniority: true });
    expect(b).toHaveLength(0);
  });
});

describe('overtime / night / holiday — Art.164-166', () => {
  it('hourly rate from monthly salary', () => {
    expect(hourlyRate(1760, 176)).toBe(10);
  });
  it('overtime ≥ 2× (Art.165)', () => {
    expect(overtimePay(5, 10)).toBe(100);
  });
  it('holiday work ≥ 2× (Art.164)', () => {
    expect(holidayWorkPay(8, 10)).toBe(160);
  });
  it('night premium +20% default (Art.166)', () => {
    expect(nightPremium(8, 10)).toBe(16);
  });
});

describe('termination — Art.77', () => {
  it('notice weeks ladder', () => {
    expect(noticeWeeks(0.5)).toBe(2);
    expect(noticeWeeks(3)).toBe(4);
    expect(noticeWeeks(7)).toBe(6);
    expect(noticeWeeks(12)).toBe(9);
  });
  it('severance multiplier ladder (Art.77.3)', () => {
    expect(severanceMultiplier(0.5)).toBe(1);
    expect(severanceMultiplier(3)).toBe(1.4);
    expect(severanceMultiplier(7)).toBe(1.7);
    expect(severanceMultiplier(12)).toBe(2);
  });
  it('severance amount = avg monthly × multiplier', () => {
    expect(severancePay(1000, 7).amount).toBe(1700);
    expect(severancePay(1000, 1, 'death').amount).toBe(3000);
  });
  it('minimum wage check (Art.155.3)', () => {
    expect(belowMinimumWage(350, 400)).toBe(true);
    expect(belowMinimumWage(400, 400)).toBe(false);
  });
  it('service years between dates', () => {
    expect(serviceYearsBetween('2020-01-01', '2025-01-01')).toBeCloseTo(5, 1);
  });
});
