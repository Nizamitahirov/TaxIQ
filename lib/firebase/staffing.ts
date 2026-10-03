'use client';

/** Ştat cədvəli (штатное расписание) — vəzifələr, say, maaş dərəcəsi (C14). */
import { listByCompany, createDoc, updateDocById, deleteDocById } from './firestore';
import { logAudit } from './audit';
import type { StaffingPosition, Employee } from '@/types';

export const listStaffingPositions = (companyId: string) => listByCompany<StaffingPosition>('staffingPositions', companyId);

export async function createStaffingPosition(input: Omit<StaffingPosition, 'id' | 'createdAt'> & { createdBy: string }): Promise<string> {
  const id = await createDoc('staffingPositions', input as Record<string, unknown>);
  await logAudit({ companyId: input.companyId, userId: input.createdBy, action: 'STAFFING_POSITION_CREATED', entityType: 'staffingPosition', entityId: id, after: { title: input.title } });
  return id;
}
export const updateStaffingPosition = (id: string, patch: Partial<StaffingPosition>) => updateDocById('staffingPositions', id, patch as Record<string, unknown>);
export async function deleteStaffingPosition(p: StaffingPosition, actorUid: string): Promise<void> {
  await deleteDocById('staffingPositions', p.id);
  await logAudit({ companyId: p.companyId, userId: actorUid, action: 'STAFFING_POSITION_DELETED', entityType: 'staffingPosition', entityId: p.id });
}

export interface StaffingRow extends StaffingPosition {
  actualCount: number;   // faktiki tutulmuş (aktiv işçilər)
  vacant: number;        // boş ştat (planned − actual)
  overStaffed: boolean;  // faktiki > plan
}

/** Ştat cədvəlini faktiki işçi sayı ilə müqayisə et (vəzifə + şöbə üzrə) */
export function reconcileStaffing(positions: StaffingPosition[], employees: Employee[]): StaffingRow[] {
  const active = employees.filter((e) => e.status === 'active');
  return positions.map((p) => {
    const actualCount = active.filter((e) =>
      (e.position ?? '').trim().toLowerCase() === p.title.trim().toLowerCase() &&
      (!p.departmentId || e.departmentId === p.departmentId),
    ).length;
    const vacant = Math.max(0, p.plannedCount - actualCount);
    return { ...p, actualCount, vacant, overStaffed: actualCount > p.plannedCount };
  });
}

/** Ümumi xülasə */
export function staffingTotals(rows: StaffingRow[]): { planned: number; actual: number; vacant: number } {
  return rows.reduce((s, r) => ({ planned: s.planned + r.plannedCount, actual: s.actual + r.actualCount, vacant: s.vacant + r.vacant }), { planned: 0, actual: 0, vacant: 0 });
}
