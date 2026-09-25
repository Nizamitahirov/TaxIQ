'use client';

/**
 * Ticarət/logistika sənədləri — mühasibat yazısı yaratmır, yalnız reyestr + çap:
 *  - Malların təhvil verilməsi qaiməsi (Goods Despatched Note) — sənəd №5
 *  - Remittance advice (ödəniş məktubu) — sənəd №11
 *  - CMR (əmtəə-nəqliyyat qaiməsi, yerli+beynəlxalq) — sənəd №12
 */
import { listByCompanySorted, createDoc, updateDocById, deleteDocById } from './firestore';
import { logAudit } from './audit';
import type { DeliveryNote, DeliveryNoteStatus, RemittanceAdvice, CmrConsignment, Invoice } from '@/types';

/* ─────────────── Delivery Note (Goods Despatched Note) ─────────────── */

export const listDeliveryNotes = (companyId: string) =>
  listByCompanySorted<DeliveryNote>('deliveryNotes', companyId, 'despatchDate', 'desc');

async function nextDeliveryNumber(companyId: string): Promise<string> {
  const all = await listDeliveryNotes(companyId);
  return `TTN-${String(all.length + 1).padStart(4, '0')}`;
}

export async function createDeliveryNote(input: Omit<DeliveryNote, 'id' | 'deliveryNoteNumber' | 'createdAt' | 'updatedAt'> & { createdBy: string }): Promise<string> {
  const deliveryNoteNumber = await nextDeliveryNumber(input.companyId);
  const id = await createDoc('deliveryNotes', { ...input, deliveryNoteNumber });
  await logAudit({ companyId: input.companyId, userId: input.createdBy, action: 'DELIVERY_NOTE_CREATED', entityType: 'deliveryNote', entityId: id, after: { deliveryNoteNumber } });
  return id;
}

/** Fakturadan malların təhvil-verilmə qaiməsi yaradır. */
export async function deliveryNoteFromInvoice(inv: Invoice, createdBy: string, extra?: Partial<DeliveryNote>): Promise<string> {
  return createDeliveryNote({
    companyId: inv.companyId, customerId: inv.customerId, customerName: inv.customerName ?? '',
    sourceInvoiceId: inv.id, sourceOrderId: inv.sourceOrderId ?? null,
    despatchDate: new Date().toISOString().slice(0, 10), deliveryAddress: extra?.deliveryAddress ?? null,
    lineItems: inv.lineItems, status: 'draft', carrier: extra?.carrier ?? null,
    vehiclePlate: extra?.vehiclePlate ?? null, driverName: extra?.driverName ?? null, notes: extra?.notes ?? null,
    createdBy,
  });
}

export async function setDeliveryNoteStatus(dn: DeliveryNote, status: DeliveryNoteStatus, actorUid: string): Promise<void> {
  await updateDocById('deliveryNotes', dn.id, { status });
  await logAudit({ companyId: dn.companyId, userId: actorUid, action: `DELIVERY_NOTE_${status.toUpperCase()}`, entityType: 'deliveryNote', entityId: dn.id });
}

export async function deleteDeliveryNote(dn: DeliveryNote, actorUid: string): Promise<void> {
  await deleteDocById('deliveryNotes', dn.id);
  await logAudit({ companyId: dn.companyId, userId: actorUid, action: 'DELIVERY_NOTE_DELETED', entityType: 'deliveryNote', entityId: dn.id });
}

/* ─────────────── Remittance Advice (ödəniş məktubu) ─────────────── */

export const listRemittanceAdvices = (companyId: string) =>
  listByCompanySorted<RemittanceAdvice>('remittanceAdvices', companyId, 'paymentDate', 'desc');

async function nextAdviceNumber(companyId: string): Promise<string> {
  const all = await listRemittanceAdvices(companyId);
  return `RA-${String(all.length + 1).padStart(4, '0')}`;
}

export async function createRemittanceAdvice(input: Omit<RemittanceAdvice, 'id' | 'adviceNumber' | 'totalAmount' | 'createdAt'> & { createdBy: string }): Promise<string> {
  const adviceNumber = await nextAdviceNumber(input.companyId);
  const totalAmount = Math.round(input.allocations.reduce((s, a) => s + (a.amount || 0), 0) * 100) / 100;
  const id = await createDoc('remittanceAdvices', { ...input, adviceNumber, totalAmount });
  await logAudit({ companyId: input.companyId, userId: input.createdBy, action: 'REMITTANCE_ADVICE_CREATED', entityType: 'remittanceAdvice', entityId: id, after: { adviceNumber, totalAmount } });
  return id;
}

export async function deleteRemittanceAdvice(ra: RemittanceAdvice, actorUid: string): Promise<void> {
  await deleteDocById('remittanceAdvices', ra.id);
  await logAudit({ companyId: ra.companyId, userId: actorUid, action: 'REMITTANCE_ADVICE_DELETED', entityType: 'remittanceAdvice', entityId: ra.id });
}

/* ─────────────── CMR (əmtəə-nəqliyyat qaiməsi) ─────────────── */

export const listCmrConsignments = (companyId: string) =>
  listByCompanySorted<CmrConsignment>('cmrConsignments', companyId, 'issueDate', 'desc');

async function nextCmrNumber(companyId: string): Promise<string> {
  const all = await listCmrConsignments(companyId);
  return `CMR-${String(all.length + 1).padStart(5, '0')}`;
}

export async function createCmr(input: Omit<CmrConsignment, 'id' | 'cmrNumber' | 'createdAt' | 'updatedAt'> & { createdBy: string }): Promise<string> {
  const cmrNumber = await nextCmrNumber(input.companyId);
  const id = await createDoc('cmrConsignments', { ...input, cmrNumber });
  await logAudit({ companyId: input.companyId, userId: input.createdBy, action: 'CMR_CREATED', entityType: 'cmrConsignment', entityId: id, after: { cmrNumber, kind: input.kind } });
  return id;
}

export async function updateCmr(id: string, patch: Partial<CmrConsignment>, actorUid: string): Promise<void> {
  await updateDocById('cmrConsignments', id, patch);
  if (patch.companyId) await logAudit({ companyId: patch.companyId, userId: actorUid, action: 'CMR_UPDATED', entityType: 'cmrConsignment', entityId: id });
}

export async function deleteCmr(c: CmrConsignment, actorUid: string): Promise<void> {
  await deleteDocById('cmrConsignments', c.id);
  await logAudit({ companyId: c.companyId, userId: actorUid, action: 'CMR_DELETED', entityType: 'cmrConsignment', entityId: c.id });
}
