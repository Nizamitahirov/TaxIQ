'use client';

/** Satınalma Sifarişi (PO) — procure-to-pay (07). PO → qəbul → fakturaya çevirmə. */
import { listByCompanySorted, createDoc, updateDocById } from './firestore';
import { createPurchaseBill } from './treasury';
import { logAudit } from './audit';
import type { PurchaseOrder, PurchaseOrderStatus, DocLineItem } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

export function poTotals(lines: Omit<DocLineItem, 'lineTotal'>[]) {
  let subtotal = 0, vat = 0;
  const withTotals: DocLineItem[] = lines.map((l) => {
    const net = round2((l.quantity || 0) * (l.unitPrice || 0) * (1 - (l.discountPercent || 0) / 100));
    const v = round2(net * (l.vatRate || 0) / 100);
    subtotal += net; vat += v;
    return { ...l, lineTotal: net };
  });
  return { lines: withTotals, subtotal: round2(subtotal), vatTotal: round2(vat), grandTotal: round2(subtotal + vat) };
}

export const listPurchaseOrders = (companyId: string) =>
  listByCompanySorted<PurchaseOrder>('purchaseOrders', companyId, 'orderDate', 'desc');

export async function nextPoNumber(companyId: string): Promise<string> {
  const all = await listPurchaseOrders(companyId);
  return `PO-${String(all.length + 1).padStart(4, '0')}`;
}

export async function createPurchaseOrder(input: {
  companyId: string; vendorId: string; vendorName: string; orderDate: string; expectedDate?: string | null;
  currency: string; lineItems: Omit<DocLineItem, 'lineTotal'>[]; notes?: string | null; createdBy: string;
}): Promise<string> {
  const t = poTotals(input.lineItems);
  const poNumber = await nextPoNumber(input.companyId);
  const id = await createDoc('purchaseOrders', {
    companyId: input.companyId, poNumber, vendorId: input.vendorId, vendorName: input.vendorName,
    orderDate: input.orderDate, expectedDate: input.expectedDate ?? null, lineItems: t.lines,
    subtotal: t.subtotal, vatTotal: t.vatTotal, grandTotal: t.grandTotal, currency: input.currency,
    status: 'draft', receivedAt: null, billId: null, notes: input.notes ?? null, createdBy: input.createdBy,
  });
  await logAudit({ companyId: input.companyId, userId: input.createdBy, action: 'PO_CREATED', entityType: 'purchaseOrder', entityId: id, after: { poNumber, total: t.grandTotal } });
  return id;
}

export async function setPOStatus(po: PurchaseOrder, status: PurchaseOrderStatus, actorUid: string): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === 'received') patch.receivedAt = new Date().toISOString().slice(0, 10);
  await updateDocById('purchaseOrders', po.id, patch);
  await logAudit({ companyId: po.companyId, userId: actorUid, action: `PO_${status.toUpperCase()}`, entityType: 'purchaseOrder', entityId: po.id });
}

/** PO-nu kreditor fakturaya çevirir (3-tərəfli uzlaşmanın son mərhələsi) */
export async function convertPOToBill(po: PurchaseOrder, paymentTermDays: number, actorUid: string): Promise<string> {
  const billId = await createPurchaseBill({
    companyId: po.companyId, vendorId: po.vendorId, vendorName: po.vendorName ?? '',
    issueDate: new Date().toISOString().slice(0, 10), paymentTermDays, currency: po.currency,
    lineItems: po.lineItems.map(({ lineTotal: _lt, ...rest }) => rest),
    createdBy: actorUid,
  });
  await updateDocById('purchaseOrders', po.id, { status: 'billed', billId });
  await logAudit({ companyId: po.companyId, userId: actorUid, action: 'PO_BILLED', entityType: 'purchaseOrder', entityId: po.id, after: { billId } });
  return billId;
}
