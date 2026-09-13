import {
  runTransaction, doc, serverTimestamp, orderBy, where,
} from 'firebase/firestore';
import { getDb } from './config';
import { listByCompany, createDoc, updateDocById } from './firestore';
import { logAudit } from './audit';
import { listAccounts, postJournalEntry } from './accounting';
import type {
  Good, GoodCategory, Warehouse, StockMovement, StockBalance, StockTransfer, MovementType,
} from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;
const IN_TYPES: MovementType[] = ['purchase_in', 'adjustment_in', 'transfer_in', 'return_in'];

// ── Kataloq ──────────────────────────────────────────────────
export const listGoods = (companyId: string) => listByCompany<Good>('goods', companyId);
export const createGood = (d: Omit<Good, 'id'>) => createDoc('goods', d as Record<string, unknown>);
export const updateGood = (id: string, d: Partial<Good>) => updateDocById('goods', id, d as Record<string, unknown>);
export const listGoodCategories = (companyId: string) => listByCompany<GoodCategory>('goodCategories', companyId);
export const createGoodCategory = (d: Omit<GoodCategory, 'id'>) => createDoc('goodCategories', d as Record<string, unknown>);

// ── Anbarlar ─────────────────────────────────────────────────
export const listWarehouses = (companyId: string) => listByCompany<Warehouse>('warehouses', companyId);
export const createWarehouse = (d: Omit<Warehouse, 'id'>) => createDoc('warehouses', d as Record<string, unknown>);

// ── Qalıqlar və hərəkətlər ───────────────────────────────────
export const listStockBalances = (companyId: string) => listByCompany<StockBalance>('stockBalances', companyId);
export const listStockMovements = (companyId: string) => listByCompany<StockMovement>('stockMovements', companyId, [orderBy('movementDate', 'desc')]);

export interface PostMovementInput {
  companyId: string;
  warehouseId: string;
  warehouseName?: string;
  goodId: string;
  goodName?: string;
  movementType: MovementType;
  quantity: number;
  unitCost?: number | null;
  movementDate: string;
  note?: string;
  relatedDocumentType?: string | null;
  relatedDocumentId?: string | null;
  performedBy: string;
}

/**
 * Ehtiyat hərəkəti + stockBalances (tranzaksiya-təhlükəsiz, orta çəkili qiymət) — 05 §3, §4.2.
 * Qaytarır: { movementId, cogs } — çıxış hərəkətləri üçün COGS dəyəri.
 */
export async function postMovement(input: PostMovementInput): Promise<{ movementId: string; cogs: number }> {
  if (input.quantity <= 0) throw new Error('Miqdar müsbət olmalıdır');
  const db = getDb();
  const balanceRef = doc(db, 'stockBalances', `${input.warehouseId}_${input.goodId}`);
  const isIn = IN_TYPES.includes(input.movementType);

  const cogs = await runTransaction(db, async (tx) => {
    const snap = await tx.get(balanceRef);
    const cur = snap.exists() ? snap.data() as StockBalance : null;
    const qtyNow = cur?.quantityOnHand ?? 0;
    const avgNow = cur?.averageCost ?? 0;
    let newQty: number, newAvg: number, movementCogs = 0;

    if (isIn) {
      const inCost = input.unitCost ?? avgNow;
      newQty = round2(qtyNow + input.quantity);
      newAvg = newQty > 0 ? round2((qtyNow * avgNow + input.quantity * inCost) / newQty) : inCost;
    } else {
      if (input.quantity > qtyNow + 0.0001) throw new Error(`Kifayət qədər qalıq yoxdur (mövcud: ${qtyNow})`);
      newQty = round2(qtyNow - input.quantity);
      newAvg = avgNow; // çıxış orta qiyməti dəyişmir
      movementCogs = round2(input.quantity * avgNow);
    }

    const data: Omit<StockBalance, 'id'> = {
      companyId: input.companyId, warehouseId: input.warehouseId, goodId: input.goodId,
      quantityOnHand: newQty, averageCost: newAvg, totalValue: round2(newQty * newAvg),
    };
    tx.set(balanceRef, { ...data, lastMovementAt: serverTimestamp() }, { merge: true });
    return movementCogs;
  });

  const movementId = await createDoc('stockMovements', {
    companyId: input.companyId, warehouseId: input.warehouseId, warehouseName: input.warehouseName ?? '',
    goodId: input.goodId, goodName: input.goodName ?? '', movementType: input.movementType,
    quantity: input.quantity, unitCost: isIn ? (input.unitCost ?? null) : round2(cogs / input.quantity),
    relatedDocumentType: input.relatedDocumentType ?? null, relatedDocumentId: input.relatedDocumentId ?? null,
    movementDate: input.movementDate, note: input.note ?? null, journalEntryId: null, performedBy: input.performedBy,
  });
  return { movementId, cogs };
}

/** Satış çıxışı + COGS jurnal yazısı (Dt 701 / Kt 205) — 08 §2.3 */
export async function issueWithCogs(input: PostMovementInput & { baseCurrency: string }): Promise<void> {
  const { movementId, cogs } = await postMovement(input);
  if (cogs > 0) {
    const accounts = await listAccounts(input.companyId);
    const find = (c: string) => accounts.find((a) => a.accountCode === c);
    const cogsAcct = find('701'), inv = find('205');
    if (cogsAcct && inv) {
      const jid = await postJournalEntry({
        companyId: input.companyId, entryDate: input.movementDate,
        description: `COGS — ${input.goodName ?? ''} (${input.quantity})`, sourceType: 'stock_movement', sourceDocumentId: movementId,
        lines: [
          { accountId: cogsAcct.id, accountCode: '701', accountName: cogsAcct.accountName.az, debit: cogs, credit: 0 },
          { accountId: inv.id, accountCode: '205', accountName: inv.accountName.az, debit: 0, credit: cogs },
        ], createdBy: input.performedBy, baseCurrency: input.baseCurrency,
      });
      await updateDocById('stockMovements', movementId, { journalEntryId: jid });
    }
  }
}

/** Minimum səviyyədən aşağı mallar (05 §5) */
export function lowStockItems(goods: Good[], balances: StockBalance[]): { good: Good; onHand: number }[] {
  const byGood = new Map<string, number>();
  for (const b of balances) byGood.set(b.goodId, (byGood.get(b.goodId) ?? 0) + b.quantityOnHand);
  return goods
    .filter((g) => g.trackInventory && g.reorderPoint != null)
    .map((g) => ({ good: g, onHand: byGood.get(g.id) ?? 0 }))
    .filter((x) => x.onHand <= (x.good.reorderPoint ?? 0));
}

// ── Transfer (2 addımlı, 05 §7) ──────────────────────────────
export const listTransfers = (companyId: string) => listByCompany<StockTransfer>('stockTransfers', companyId, [orderBy('createdAt', 'desc')]);

export async function createTransfer(d: Omit<StockTransfer, 'id' | 'status'> & { requestedBy: string }): Promise<string> {
  return createDoc('stockTransfers', { ...d, status: 'pending' } as Record<string, unknown>);
}

export async function shipTransfer(t: StockTransfer, warehouseName: string, actorUid: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  for (const it of t.items) {
    await postMovement({
      companyId: t.companyId, warehouseId: t.fromWarehouseId, warehouseName, goodId: it.goodId, goodName: it.goodName,
      movementType: 'transfer_out', quantity: it.quantity, movementDate: date,
      relatedDocumentType: 'stockTransfer', relatedDocumentId: t.id, performedBy: actorUid,
    });
  }
  await updateDocById('stockTransfers', t.id, { status: 'in_transit', shippedAt: serverTimestamp() });
  await logAudit({ companyId: t.companyId, userId: actorUid, action: 'TRANSFER_SHIPPED', entityType: 'stockTransfer', entityId: t.id });
}

export async function receiveTransfer(t: StockTransfer, warehouseName: string, actorUid: string): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  // transfer_out-un orta qiymətini saxlamaq üçün mənbə balansından unitCost götürülür (sadələşdirilmiş: cari avg)
  for (const it of t.items) {
    await postMovement({
      companyId: t.companyId, warehouseId: t.toWarehouseId, warehouseName, goodId: it.goodId, goodName: it.goodName,
      movementType: 'transfer_in', quantity: it.quantity, unitCost: null, movementDate: date,
      relatedDocumentType: 'stockTransfer', relatedDocumentId: t.id, performedBy: actorUid,
    });
  }
  await updateDocById('stockTransfers', t.id, { status: 'completed', receivedAt: serverTimestamp() });
  await logAudit({ companyId: t.companyId, userId: actorUid, action: 'TRANSFER_RECEIVED', entityType: 'stockTransfer', entityId: t.id });
}

export { where };
