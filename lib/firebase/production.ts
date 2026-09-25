'use client';

/**
 * İstehsal / Resept (BOM) — əməliyyat №6.
 * İstehsal sifarişi tamamlananda: Dt 204 (Hazır məhsul) / Kt 201 (Material) + Kt 533 (Əmək) + Kt 731 (Üstəlik).
 */
import { listByCompanySorted, listByCompany, createDoc, updateDocById, deleteDocById } from './firestore';
import { listAccounts, postJournalEntry } from './accounting';
import { logAudit } from './audit';
import type { BillOfMaterials, BomComponent, ProductionOrder, ProductionOrderStatus } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

/* ─────────── Bill of Materials (resept) ─────────── */

export const listBoms = (companyId: string) => listByCompany<BillOfMaterials>('billsOfMaterials', companyId);

export function bomComponentsCost(components: BomComponent[]): number {
  return round2(components.reduce((s, c) => s + (c.quantity || 0) * (c.unitCost || 0), 0));
}

export async function createBom(input: Omit<BillOfMaterials, 'id' | 'createdAt' | 'updatedAt'> & { createdBy: string }): Promise<string> {
  const id = await createDoc('billsOfMaterials', input);
  await logAudit({ companyId: input.companyId, userId: input.createdBy, action: 'BOM_CREATED', entityType: 'billOfMaterials', entityId: id, after: { product: input.productName } });
  return id;
}

export async function updateBom(id: string, patch: Partial<BillOfMaterials>): Promise<void> {
  await updateDocById('billsOfMaterials', id, patch);
}

export async function deleteBom(bom: BillOfMaterials, actorUid: string): Promise<void> {
  await deleteDocById('billsOfMaterials', bom.id);
  await logAudit({ companyId: bom.companyId, userId: actorUid, action: 'BOM_DELETED', entityType: 'billOfMaterials', entityId: bom.id });
}

/* ─────────── Production orders ─────────── */

export const listProductionOrders = (companyId: string) =>
  listByCompanySorted<ProductionOrder>('productionOrders', companyId, 'startDate', 'desc');

async function nextOrderNumber(companyId: string): Promise<string> {
  const all = await listProductionOrders(companyId);
  return `PROD-${String(all.length + 1).padStart(4, '0')}`;
}

/** BOM əsasında sifariş miqdarına uyğun məsrəf hesablayır. */
export function scaleOrder(bom: Pick<BillOfMaterials, 'components' | 'outputQuantity' | 'laborCost' | 'overheadCost'>, quantity: number) {
  const factor = bom.outputQuantity > 0 ? quantity / bom.outputQuantity : 1;
  const components: BomComponent[] = bom.components.map((c) => ({ ...c, quantity: round2((c.quantity || 0) * factor) }));
  const materialCost = bomComponentsCost(components);
  const laborCost = round2((bom.laborCost || 0) * factor);
  const overheadCost = round2((bom.overheadCost || 0) * factor);
  const totalCost = round2(materialCost + laborCost + overheadCost);
  return { components, materialCost, laborCost, overheadCost, totalCost, unitCost: quantity > 0 ? round2(totalCost / quantity) : 0 };
}

export async function createProductionOrder(input: {
  companyId: string; bomId?: string | null; productGoodId?: string | null; productName: string;
  quantity: number; startDate: string; components: BomComponent[];
  materialCost: number; laborCost: number; overheadCost: number; notes?: string | null; createdBy: string;
}): Promise<string> {
  const orderNumber = await nextOrderNumber(input.companyId);
  const totalCost = round2(input.materialCost + input.laborCost + input.overheadCost);
  const unitCost = input.quantity > 0 ? round2(totalCost / input.quantity) : 0;
  const id = await createDoc('productionOrders', {
    companyId: input.companyId, orderNumber, bomId: input.bomId ?? null, productGoodId: input.productGoodId ?? null,
    productName: input.productName, quantity: input.quantity, startDate: input.startDate, completedDate: null,
    status: 'planned', components: input.components, materialCost: round2(input.materialCost),
    laborCost: round2(input.laborCost), overheadCost: round2(input.overheadCost), totalCost, unitCost,
    journalEntryId: null, notes: input.notes ?? null, createdBy: input.createdBy,
  });
  await logAudit({ companyId: input.companyId, userId: input.createdBy, action: 'PRODUCTION_ORDER_CREATED', entityType: 'productionOrder', entityId: id, after: { orderNumber, product: input.productName, total: totalCost } });
  return id;
}

export async function setProductionStatus(order: ProductionOrder, status: ProductionOrderStatus, actorUid: string): Promise<void> {
  await updateDocById('productionOrders', order.id, { status });
  await logAudit({ companyId: order.companyId, userId: actorUid, action: `PRODUCTION_${status.toUpperCase()}`, entityType: 'productionOrder', entityId: order.id });
}

/**
 * İstehsalı tamamlayır və maya dəyərini kapitallaşdırır:
 *   Dt 204 (Hazır məhsul) totalCost
 *   Kt 201 (Material) materialCost, Kt 533 (Əmək) laborCost, Kt 731 (Üstəlik) overheadCost
 */
export async function completeProductionOrder(order: ProductionOrder, actorUid: string): Promise<string | null> {
  if (order.status === 'completed') throw new Error('Sifariş artıq tamamlanıb');
  const accounts = await listAccounts(order.companyId);
  const find = (c: string) => accounts.find((a) => a.accountCode === c);
  const finished = find('204') ?? find('205'), material = find('201'), labor = find('533'), overhead = find('731');
  const completedDate = new Date().toISOString().slice(0, 10);

  let journalEntryId: string | null = null;
  if (finished && material && order.totalCost > 0) {
    const lines: { accountId: string; accountCode: string; accountName: string; debit: number; credit: number }[] = [
      { accountId: finished.id, accountCode: finished.accountCode, accountName: finished.accountName.az, debit: order.totalCost, credit: 0 },
      { accountId: material.id, accountCode: material.accountCode, accountName: material.accountName.az, debit: 0, credit: order.materialCost },
    ];
    if (order.laborCost > 0 && labor) lines.push({ accountId: labor.id, accountCode: labor.accountCode, accountName: labor.accountName.az, debit: 0, credit: order.laborCost });
    if (order.overheadCost > 0 && overhead) lines.push({ accountId: overhead.id, accountCode: overhead.accountCode, accountName: overhead.accountName.az, debit: 0, credit: order.overheadCost });
    // Əgər əmək/üstəlik hesabı tapılmayıbsa, qalığı materiala yönəlt (balans üçün)
    const credited = lines.slice(1).reduce((s, l) => s + l.credit, 0);
    if (round2(credited) !== order.totalCost) lines[1].credit = round2(lines[1].credit + (order.totalCost - credited));

    journalEntryId = await postJournalEntry({
      companyId: order.companyId, entryDate: completedDate,
      description: `İstehsal ${order.orderNumber} — ${order.productName} (${order.quantity})`,
      sourceType: 'production', sourceDocumentId: order.id, lines, createdBy: actorUid,
    });
  }

  await updateDocById('productionOrders', order.id, { status: 'completed', completedDate, journalEntryId });
  await logAudit({ companyId: order.companyId, userId: actorUid, action: 'PRODUCTION_COMPLETED', entityType: 'productionOrder', entityId: order.id, after: { total: order.totalCost, journalEntryId } });
  return journalEntryId;
}

export async function deleteProductionOrder(order: ProductionOrder, actorUid: string): Promise<void> {
  await deleteDocById('productionOrders', order.id);
  await logAudit({ companyId: order.companyId, userId: actorUid, action: 'PRODUCTION_DELETED', entityType: 'productionOrder', entityId: order.id });
}
