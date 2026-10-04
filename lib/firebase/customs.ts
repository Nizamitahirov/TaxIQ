'use client';

/** Gömrük bəyannamələri — Gömrük Məcəlləsi. */
import { listByCompanySorted, createDoc, updateDocById, deleteDocById } from './firestore';
import { logAudit } from './audit';
import { computeCustoms } from '@/lib/customs/engine';
import type { CustomsDeclaration, CustomsDeclStatus, CustomsLine, CustomsRegime } from '@/types';

export const listCustomsDeclarations = (companyId: string) =>
  listByCompanySorted<CustomsDeclaration>('customsDeclarations', companyId, 'declarationDate', 'desc');

export async function nextDeclarationNumber(companyId: string): Promise<string> {
  const all = await listCustomsDeclarations(companyId);
  const year = new Date().getFullYear();
  return `GB-${String(all.length + 1).padStart(4, '0')}/${year}`;
}

export interface CustomsInput {
  companyId: string;
  declarationNumber: string;
  regime: CustomsRegime;
  declarationDate: string;
  counterparty?: string | null;
  originCountry?: string | null;
  currency?: string;
  lines: CustomsLine[];
  customsFee?: number;
  notes?: string | null;
  createdBy: string;
}

export async function createCustomsDeclaration(input: CustomsInput): Promise<string> {
  const totals = computeCustoms(input.lines, input.regime, input.customsFee ?? 0);
  const doc = {
    ...input, customsFee: totals.customsFee, status: 'draft' as CustomsDeclStatus,
    totalCustomsValue: totals.totalCustomsValue, totalDuty: totals.totalDuty, totalExcise: totals.totalExcise,
    totalImportVat: totals.totalImportVat, totalPayable: totals.totalPayable,
  };
  const id = await createDoc('customsDeclarations', doc as Record<string, unknown>);
  await logAudit({ companyId: input.companyId, userId: input.createdBy, action: 'CUSTOMS_DECL_CREATED', entityType: 'customsDeclaration', entityId: id, after: { number: input.declarationNumber, payable: totals.totalPayable } });
  return id;
}

export async function setCustomsStatus(d: CustomsDeclaration, status: CustomsDeclStatus, actorUid: string): Promise<void> {
  await updateDocById('customsDeclarations', d.id, { status });
  await logAudit({ companyId: d.companyId, userId: actorUid, action: `CUSTOMS_DECL_${status.toUpperCase()}`, entityType: 'customsDeclaration', entityId: d.id });
}

export async function deleteCustomsDeclaration(d: CustomsDeclaration, actorUid: string): Promise<void> {
  await deleteDocById('customsDeclarations', d.id);
  await logAudit({ companyId: d.companyId, userId: actorUid, action: 'CUSTOMS_DECL_DELETED', entityType: 'customsDeclaration', entityId: d.id });
}
