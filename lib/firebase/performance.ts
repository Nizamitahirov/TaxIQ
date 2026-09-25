'use client';

/** Performans qiymətləndirmə — çəkili meyarlar üzrə bal (1–5). */
import { listByCompanySorted, createDoc, updateDocById, deleteDocById } from './firestore';
import { logAudit } from './audit';
import type { PerformanceReview, PerformanceCriterion, PerformanceStatus } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

export const listPerformanceReviews = (companyId: string) =>
  listByCompanySorted<PerformanceReview>('performanceReviews', companyId, 'reviewDate', 'desc');

/** Çəkili orta bal (1–5). Çəki cəmi 0-dırsa sadə orta. */
export function weightedScore(criteria: PerformanceCriterion[]): number {
  if (criteria.length === 0) return 0;
  const totalW = criteria.reduce((s, c) => s + (c.weight || 0), 0);
  if (totalW <= 0) return round2(criteria.reduce((s, c) => s + (c.score || 0), 0) / criteria.length);
  return round2(criteria.reduce((s, c) => s + (c.score || 0) * (c.weight || 0), 0) / totalW);
}

export async function createPerformanceReview(input: Omit<PerformanceReview, 'id' | 'overallScore' | 'createdAt' | 'updatedAt'> & { createdBy: string }): Promise<string> {
  const overallScore = weightedScore(input.criteria);
  const id = await createDoc('performanceReviews', { ...input, overallScore });
  await logAudit({ companyId: input.companyId, userId: input.createdBy, action: 'PERFORMANCE_REVIEW_CREATED', entityType: 'performanceReview', entityId: id, after: { employee: input.employeeName, score: overallScore } });
  return id;
}

export async function updatePerformanceReview(id: string, patch: Partial<PerformanceReview>): Promise<void> {
  const next = patch.criteria ? { ...patch, overallScore: weightedScore(patch.criteria) } : patch;
  await updateDocById('performanceReviews', id, next as Record<string, unknown>);
}

export async function setPerformanceStatus(r: PerformanceReview, status: PerformanceStatus, actorUid: string): Promise<void> {
  await updateDocById('performanceReviews', r.id, { status });
  await logAudit({ companyId: r.companyId, userId: actorUid, action: `PERFORMANCE_${status.toUpperCase()}`, entityType: 'performanceReview', entityId: r.id });
}

export async function deletePerformanceReview(r: PerformanceReview, actorUid: string): Promise<void> {
  await deleteDocById('performanceReviews', r.id);
  await logAudit({ companyId: r.companyId, userId: actorUid, action: 'PERFORMANCE_REVIEW_DELETED', entityType: 'performanceReview', entityId: r.id });
}
