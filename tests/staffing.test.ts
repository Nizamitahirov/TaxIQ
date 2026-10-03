import { describe, it, expect } from 'vitest';
import { reconcileStaffing, staffingTotals } from '@/lib/firebase/staffing';
import type { StaffingPosition, Employee } from '@/types';

const pos = (title: string, plannedCount: number, departmentId?: string): StaffingPosition =>
  ({ id: title, companyId: 'c', title, plannedCount, departmentId: departmentId ?? null });
const emp = (position: string, departmentId?: string, status: Employee['status'] = 'active'): Employee =>
  ({ id: Math.random().toString(), companyId: 'c', employeeCode: 'E', firstName: 'A', lastName: 'B', position, departmentId: departmentId ?? null, baseSalary: 500, status } as Employee);

describe('ştat cədvəli reconciliation (C14)', () => {
  it('counts active employees matching title + department', () => {
    const rows = reconcileStaffing(
      [pos('Mühasib', 2, 'd1')],
      [emp('Mühasib', 'd1'), emp('Mühasib', 'd1'), emp('Mühasib', 'd2')],
    );
    expect(rows[0].actualCount).toBe(2);
    expect(rows[0].vacant).toBe(0);
    expect(rows[0].overStaffed).toBe(false);
  });
  it('matches title case-insensitively and ignores department when position has none', () => {
    const rows = reconcileStaffing([pos('Direktor', 1)], [emp('direktor', 'd9')]);
    expect(rows[0].actualCount).toBe(1);
  });
  it('flags vacancies and over-staffing; excludes terminated', () => {
    const rows = reconcileStaffing(
      [pos('Satıcı', 3, 'd1')],
      [emp('Satıcı', 'd1'), emp('Satıcı', 'd1', 'terminated')],
    );
    expect(rows[0].actualCount).toBe(1);
    expect(rows[0].vacant).toBe(2);
    const over = reconcileStaffing([pos('Usta', 1, 'd1')], [emp('Usta', 'd1'), emp('Usta', 'd1')]);
    expect(over[0].overStaffed).toBe(true);
    expect(over[0].vacant).toBe(0);
  });
  it('totals planned/actual/vacant', () => {
    const rows = reconcileStaffing([pos('A', 2, 'd1'), pos('B', 3, 'd1')], [emp('A', 'd1')]);
    expect(staffingTotals(rows)).toEqual({ planned: 5, actual: 1, vacant: 4 });
  });
});
