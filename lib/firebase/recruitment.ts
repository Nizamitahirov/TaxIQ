'use client';

/** İşə qəbul — vakansiyalar + namizədlər (pipeline). */
import { listByCompanySorted, createDoc, updateDocById, deleteDocById } from './firestore';
import { logAudit } from './audit';
import type { Vacancy, VacancyStatus, Candidate, CandidateStage } from '@/types';

export const listVacancies = (companyId: string) => listByCompanySorted<Vacancy>('vacancies', companyId, 'openedDate', 'desc');
export const listCandidates = (companyId: string) => listByCompanySorted<Candidate>('candidates', companyId, 'appliedDate', 'desc');

export async function createVacancy(input: Omit<Vacancy, 'id' | 'createdAt' | 'updatedAt'> & { createdBy: string }): Promise<string> {
  const id = await createDoc('vacancies', input);
  await logAudit({ companyId: input.companyId, userId: input.createdBy, action: 'VACANCY_CREATED', entityType: 'vacancy', entityId: id, after: { title: input.title } });
  return id;
}
export const updateVacancy = (id: string, patch: Partial<Vacancy>) => updateDocById('vacancies', id, patch as Record<string, unknown>);
export async function setVacancyStatus(v: Vacancy, status: VacancyStatus, actorUid: string): Promise<void> {
  await updateDocById('vacancies', v.id, { status, ...(status === 'closed' || status === 'filled' ? { closedDate: new Date().toISOString().slice(0, 10) } : {}) });
  await logAudit({ companyId: v.companyId, userId: actorUid, action: `VACANCY_${status.toUpperCase()}`, entityType: 'vacancy', entityId: v.id });
}
export async function deleteVacancy(v: Vacancy, actorUid: string): Promise<void> {
  await deleteDocById('vacancies', v.id);
  await logAudit({ companyId: v.companyId, userId: actorUid, action: 'VACANCY_DELETED', entityType: 'vacancy', entityId: v.id });
}

export async function createCandidate(input: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'> & { createdBy: string }): Promise<string> {
  const id = await createDoc('candidates', input);
  await logAudit({ companyId: input.companyId, userId: input.createdBy, action: 'CANDIDATE_CREATED', entityType: 'candidate', entityId: id, after: { name: input.fullName } });
  return id;
}
export const updateCandidate = (id: string, patch: Partial<Candidate>) => updateDocById('candidates', id, patch as Record<string, unknown>);
export async function setCandidateStage(c: Candidate, stage: CandidateStage, actorUid: string): Promise<void> {
  await updateDocById('candidates', c.id, { stage });
  await logAudit({ companyId: c.companyId, userId: actorUid, action: `CANDIDATE_${stage.toUpperCase()}`, entityType: 'candidate', entityId: c.id });
}
export async function deleteCandidate(c: Candidate, actorUid: string): Promise<void> {
  await deleteDocById('candidates', c.id);
  await logAudit({ companyId: c.companyId, userId: actorUid, action: 'CANDIDATE_DELETED', entityType: 'candidate', entityId: c.id });
}
