'use client';

/** Müqavilələr mərkəzi reyestri (sənəd №10) — müştəri/təchizatçı/işçi müqavilələri. */
import { listByCompanySorted, createDoc, updateDocById, deleteDocById } from './firestore';
import { logAudit } from './audit';
import type { Contract, ContractStatus } from '@/types';

export const listContracts = (companyId: string) =>
  listByCompanySorted<Contract>('contracts', companyId, 'startDate', 'desc');

async function nextContractNumber(companyId: string): Promise<string> {
  const all = await listContracts(companyId);
  const year = new Date().getFullYear();
  return `MÜQ-${year}-${String(all.length + 1).padStart(4, '0')}`;
}

export type ContractInput = Omit<Contract, 'id' | 'contractNumber' | 'createdAt' | 'updatedAt'> & { contractNumber?: string };

export async function createContract(input: ContractInput & { createdBy: string }): Promise<string> {
  const contractNumber = input.contractNumber?.trim() || (await nextContractNumber(input.companyId));
  const id = await createDoc('contracts', { ...input, contractNumber });
  await logAudit({ companyId: input.companyId, userId: input.createdBy, action: 'CONTRACT_CREATED', entityType: 'contract', entityId: id, after: { contractNumber, party: input.partyName } });
  return id;
}

export async function updateContract(id: string, patch: Partial<Contract>, actorUid: string): Promise<void> {
  await updateDocById('contracts', id, patch);
  if (patch.companyId) await logAudit({ companyId: patch.companyId, userId: actorUid, action: 'CONTRACT_UPDATED', entityType: 'contract', entityId: id });
}

export async function setContractStatus(c: Contract, status: ContractStatus, actorUid: string): Promise<void> {
  await updateDocById('contracts', c.id, { status });
  await logAudit({ companyId: c.companyId, userId: actorUid, action: `CONTRACT_${status.toUpperCase()}`, entityType: 'contract', entityId: c.id });
}

export async function deleteContract(c: Contract, actorUid: string): Promise<void> {
  await deleteDocById('contracts', c.id);
  await logAudit({ companyId: c.companyId, userId: actorUid, action: 'CONTRACT_DELETED', entityType: 'contract', entityId: c.id, before: { contractNumber: c.contractNumber } });
}

/** Bitmə tarixinə görə status hesablayır (aktiv/bitmiş) + bildiriş pəncərəsi. */
export function contractHealth(c: Contract, today = new Date()): { expiringSoon: boolean; daysLeft: number | null } {
  if (!c.endDate) return { expiringSoon: false, daysLeft: null };
  const end = new Date(c.endDate);
  const daysLeft = Math.ceil((end.getTime() - today.getTime()) / 86400000);
  const notice = c.renewalNoticeDays ?? 30;
  return { expiringSoon: c.status === 'active' && daysLeft >= 0 && daysLeft <= notice, daysLeft };
}
