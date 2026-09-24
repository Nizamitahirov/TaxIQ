import {  } from 'firebase/firestore';
import { listByCompany, listByCompanySorted, createDoc, updateDocById, deleteDocById, setDocById } from './firestore';
import { logAudit } from './audit';
import { uploadFile, deleteStorageFile } from './storage';
import type {
  HseFolder, HseDocument, HseTrainingType, HseTrainingRecord, HseAudit, HseWorkPermit,
} from '@/types';

// ── Tarix köməkçiləri ──
export function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
export function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr + 'T00:00:00');
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}
export type TrainingStatus = 'valid' | 'expiring' | 'expired';
export function trainingStatus(nextDueDate: string): TrainingStatus {
  const d = daysUntil(nextDueDate);
  if (d < 0) return 'expired';
  if (d <= 30) return 'expiring';
  return 'valid';
}

// ── Kitabxana: qovluqlar ──
export const listHseFolders = (companyId: string) => listByCompanySorted<HseFolder>('hseFolders', companyId, 'name', 'asc');
export async function createHseFolder(companyId: string, name: string, parentId: string | null, uid: string): Promise<string> {
  return createDoc('hseFolders', { companyId, name: name.trim(), parentId: parentId ?? null, createdBy: uid });
}
export async function deleteHseFolder(id: string): Promise<void> { await deleteDocById('hseFolders', id); }

// ── Kitabxana: fayllar ──
export const listHseDocuments = (companyId: string) => listByCompanySorted<HseDocument>('hseDocuments', companyId, 'createdAt', 'desc');

export async function uploadHseDocument(input: {
  companyId: string; folderId: string | null; file: File; name?: string; category?: string | null; uid: string;
}): Promise<string> {
  const up = await uploadFile(input.companyId, 'hse/library', input.file);
  const id = await createDoc('hseDocuments', {
    companyId: input.companyId, folderId: input.folderId ?? null,
    name: (input.name?.trim() || input.file.name), fileName: up.fileName,
    url: up.url, storagePath: up.storagePath, mimeType: up.mimeType, size: up.size,
    category: input.category ?? null, uploadedByUid: input.uid,
  });
  await logAudit({ companyId: input.companyId, userId: input.uid, action: 'HSE_DOC_UPLOADED', entityType: 'hseDocument', entityId: id, after: { name: input.file.name } });
  return id;
}
export async function deleteHseDocument(doc: HseDocument): Promise<void> {
  await deleteStorageFile(doc.storagePath);
  await deleteDocById('hseDocuments', doc.id);
}

// ── Təlim növləri (konfiqurasiya) ──
export const listHseTrainingTypes = (companyId: string) => listByCompanySorted<HseTrainingType>('hseTrainingTypes', companyId, 'name', 'asc');
export async function saveHseTrainingType(input: { id?: string; companyId: string; name: string; validityMonths: number }): Promise<void> {
  if (input.id) { await updateDocById('hseTrainingTypes', input.id, { name: input.name.trim(), validityMonths: input.validityMonths }); }
  else { await createDoc('hseTrainingTypes', { companyId: input.companyId, name: input.name.trim(), validityMonths: input.validityMonths, isActive: true }); }
}
export async function deleteHseTrainingType(id: string): Promise<void> { await deleteDocById('hseTrainingTypes', id); }

// ── SƏTƏM jurnalı: təlim qeydləri ──
export const listHseTrainingRecords = (companyId: string) => listByCompanySorted<HseTrainingRecord>('hseTrainingRecords', companyId, 'completedDate', 'desc');

export async function createHseTrainingRecord(input: {
  companyId: string; employeeId: string; employeeName: string;
  trainingTypeId: string; trainingTypeName: string; validityMonths: number;
  completedDate: string; note?: string | null; signedDoc?: File | null; uid: string;
}): Promise<string> {
  let signedDocUrl: string | null = null, signedDocPath: string | null = null, signedDocUploadedAt: string | null = null;
  if (input.signedDoc) {
    const up = await uploadFile(input.companyId, 'hse/signed', input.signedDoc);
    signedDocUrl = up.url; signedDocPath = up.storagePath; signedDocUploadedAt = new Date().toISOString();
  }
  const nextDueDate = addMonths(input.completedDate, input.validityMonths);
  const id = await createDoc('hseTrainingRecords', {
    companyId: input.companyId, employeeId: input.employeeId, employeeName: input.employeeName,
    trainingTypeId: input.trainingTypeId, trainingTypeName: input.trainingTypeName,
    completedDate: input.completedDate, validityMonths: input.validityMonths, nextDueDate,
    signedDocUrl, signedDocPath, signedDocUploadedAt, note: input.note ?? null, createdBy: input.uid,
  });
  await logAudit({ companyId: input.companyId, userId: input.uid, action: 'HSE_TRAINING_RECORDED', entityType: 'hseTrainingRecord', entityId: id, after: { employee: input.employeeName, type: input.trainingTypeName } });
  return id;
}

/** Mövcud qeydə sonradan imzalı skan sənəd əlavə edir */
export async function attachSignedDoc(record: HseTrainingRecord, file: File, companyId: string): Promise<void> {
  const up = await uploadFile(companyId, 'hse/signed', file);
  await updateDocById('hseTrainingRecords', record.id, { signedDocUrl: up.url, signedDocPath: up.storagePath, signedDocUploadedAt: new Date().toISOString() });
}
export async function deleteHseTrainingRecord(rec: HseTrainingRecord): Promise<void> {
  if (rec.signedDocPath) await deleteStorageFile(rec.signedDocPath);
  await deleteDocById('hseTrainingRecords', rec.id);
}

// ── HSE Audit ──
export const listHseAudits = (companyId: string) => listByCompanySorted<HseAudit>('hseAudits', companyId, 'auditDate', 'desc');
export async function saveHseAudit(input: Omit<HseAudit, 'id' | 'createdAt'> & { id?: string }): Promise<void> {
  const { id, ...data } = input;
  if (id) await updateDocById('hseAudits', id, data as Record<string, unknown>);
  else await createDoc('hseAudits', data as Record<string, unknown>);
}
export async function deleteHseAudit(id: string): Promise<void> { await deleteDocById('hseAudits', id); }

// ── İş icazələri ──
export const listHseWorkPermits = (companyId: string) => listByCompanySorted<HseWorkPermit>('hseWorkPermits', companyId, 'createdAt', 'desc');
export async function nextPermitNumber(companyId: string): Promise<string> {
  const rows = await listByCompany<HseWorkPermit>('hseWorkPermits', companyId, []);
  const year = new Date().getFullYear();
  return `WP-${year}-${String(rows.length + 1).padStart(4, '0')}`;
}
export async function createHseWorkPermit(input: Omit<HseWorkPermit, 'id' | 'createdAt' | 'status' | 'approverUid' | 'approvedAt'> & { uid: string }): Promise<string> {
  const { uid, ...data } = input;
  return createDoc('hseWorkPermits', { ...data, status: 'draft', approverUid: null, approvedAt: null, createdBy: uid });
}
export async function decideWorkPermit(permit: HseWorkPermit, approve: boolean, uid: string): Promise<void> {
  await updateDocById('hseWorkPermits', permit.id, { status: approve ? 'approved' : 'rejected', approverUid: uid, approvedAt: new Date().toISOString() });
  await logAudit({ companyId: permit.companyId, userId: uid, action: approve ? 'HSE_PERMIT_APPROVED' : 'HSE_PERMIT_REJECTED', entityType: 'hseWorkPermit', entityId: permit.id, after: { permitNumber: permit.permitNumber } });
}
export async function setWorkPermitStatus(id: string, status: HseWorkPermit['status']): Promise<void> { await updateDocById('hseWorkPermits', id, { status }); }

export { setDocById };
