import {
  runTransaction, doc, serverTimestamp, orderBy, where,
} from 'firebase/firestore';
import { getDb } from './config';
import { listByCompany, getDocById, createDoc, updateDocById } from './firestore';
import { logAudit } from './audit';
import { listAccounts, postJournalEntry } from './accounting';
import type {
  Good, GoodCategory, Warehouse, StockMovement, StockBalance, StockTransfer, MovementType,
  StockCount, StockCountLine, PriceList,
} from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;
const IN_TYPES: MovementType[] = ['purchase_in', 'adjustment_in', 'transfer_in', 'return_in'];
export type ValuationMethod = 'fifo' | 'weighted_average';

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
  /** Dəyərləndirmə metodu (05 §4.2) — 'fifo' seçilibsə qat-əsaslı COGS hesablanır */
  valuationMethod?: ValuationMethod;
  movementDate: string;
  note?: string;
  relatedDocumentType?: string | null;
  relatedDocumentId?: string | null;
  performedBy: string;
}

/**
 * Ehtiyat hərəkəti + stockBalances (tranzaksiya-təhlükəsiz) — 05 §3, §4.2.
 * Metod: 'weighted_average' (orta çəkili) və ya 'fifo' (qat-əsaslı) dəstəklənir.
 * Qaytarır: { movementId, cogs } — çıxış hərəkətləri üçün COGS dəyəri.
 */
export async function postMovement(input: PostMovementInput): Promise<{ movementId: string; cogs: number }> {
  if (input.quantity <= 0) throw new Error('Miqdar müsbət olmalıdır');
  const db = getDb();
  const balanceRef = doc(db, 'stockBalances', `${input.warehouseId}_${input.goodId}`);
  const isIn = IN_TYPES.includes(input.movementType);
  const method: ValuationMethod = input.valuationMethod ?? 'weighted_average';

  const cogs = await runTransaction(db, async (tx) => {
    const snap = await tx.get(balanceRef);
    const cur = snap.exists() ? snap.data() as StockBalance : null;
    const qtyNow = cur?.quantityOnHand ?? 0;
    const avgNow = cur?.averageCost ?? 0;
    const layers = [...(cur?.layers ?? [])];
    let newQty: number, newAvg: number, movementCogs = 0;

    if (isIn) {
      const inCost = input.unitCost ?? avgNow;
      newQty = round2(qtyNow + input.quantity);
      newAvg = newQty > 0 ? round2((qtyNow * avgNow + input.quantity * inCost) / newQty) : inCost;
      if (method === 'fifo') layers.push({ qty: input.quantity, unitCost: inCost, date: input.movementDate });
    } else {
      if (input.quantity > qtyNow + 0.0001) throw new Error(`Kifayət qədər qalıq yoxdur (mövcud: ${qtyNow})`);
      newQty = round2(qtyNow - input.quantity);
      if (method === 'fifo') {
        // Ən köhnə qatdan başlayaraq azalt (FIFO), qarışıq COGS hesabla
        let remaining = input.quantity;
        while (remaining > 0.0001 && layers.length > 0) {
          const layer = layers[0];
          const take = Math.min(layer.qty, remaining);
          movementCogs = round2(movementCogs + take * layer.unitCost);
          layer.qty = round2(layer.qty - take);
          remaining = round2(remaining - take);
          if (layer.qty <= 0.0001) layers.shift();
        }
        if (remaining > 0.0001) movementCogs = round2(movementCogs + remaining * avgNow); // qat çatmasa avg ilə
        newAvg = newQty > 0 ? round2(layers.reduce((s, l) => s + l.qty * l.unitCost, 0) / newQty) : avgNow;
      } else {
        newAvg = avgNow; // çıxış orta qiyməti dəyişmir
        movementCogs = round2(input.quantity * avgNow);
      }
    }

    const data: Partial<StockBalance> = {
      companyId: input.companyId, warehouseId: input.warehouseId, goodId: input.goodId,
      quantityOnHand: newQty, averageCost: newAvg, totalValue: round2(newQty * newAvg),
      ...(method === 'fifo' ? { layers } : {}),
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

// ── Dəyərləndirmə metodu (05 §4.2) ──────────────────────────
export const goodValuationMethod = (g: Good): ValuationMethod => g.valuationMethodOverride ?? 'weighted_average';
/** Fəal qalığı olan malın metodu dəyişdirilə bilməz (05 §4.2) */
export function goodHasStock(balances: StockBalance[], goodId: string): boolean {
  return balances.some((b) => b.goodId === goodId && Math.abs(b.quantityOnHand) > 0.0001);
}

// ── Vahid çevrilməsi (05 §2) ────────────────────────────────
/** Seçilmiş vahiddəki miqdarı baseUnit-ə çevirir */
export function toBaseUnit(g: Good, unit: string, qty: number): number {
  if (unit === g.baseUnit) return qty;
  const conv = (g.unitConversions ?? []).find((u) => u.code === unit);
  return conv ? round2(qty * conv.factor) : qty;
}
export const goodUnits = (g: Good): string[] => [g.baseUnit, ...(g.unitConversions ?? []).map((u) => u.code)];

// ── İnventarizasiya (stocktake, 05 §6) ──────────────────────
export const listStockCounts = (companyId: string) => listByCompany<StockCount>('stockCounts', companyId, [orderBy('createdAt', 'desc')]);

/** Seçilmiş anbar üzrə cari qalıqlardan sayım sessiyası qurur (draft) */
export async function startStockCount(companyId: string, warehouseId: string, warehouseName: string, goods: Good[], balances: StockBalance[], createdBy: string): Promise<string> {
  const whBalances = balances.filter((b) => b.warehouseId === warehouseId);
  const lines: StockCountLine[] = goods.filter((g) => g.trackInventory).map((g) => {
    const b = whBalances.find((x) => x.goodId === g.id);
    const systemQty = b?.quantityOnHand ?? 0;
    return { goodId: g.id, goodName: g.name.az, systemQty, countedQty: systemQty, unitCost: b?.averageCost ?? g.defaultPurchasePrice ?? 0, variance: 0 };
  });
  return createDoc('stockCounts', {
    companyId, warehouseId, warehouseName, countDate: new Date().toISOString().slice(0, 10),
    status: 'draft', lines, note: null, createdBy, completedAt: null,
  } as Record<string, unknown>);
}

export const updateStockCount = (id: string, lines: StockCountLine[]) => updateDocById('stockCounts', id, { lines } as Record<string, unknown>);

/** Sayımı tamamla: fərqlər üçün avtomatik düzəliş hərəkətləri yaradılır (05 §6) */
export async function finalizeStockCount(count: StockCount, actorUid: string): Promise<{ adjustments: number }> {
  let adjustments = 0;
  for (const l of count.lines) {
    const variance = round2(l.countedQty - l.systemQty);
    if (Math.abs(variance) < 0.0001) continue;
    await postMovement({
      companyId: count.companyId, warehouseId: count.warehouseId, warehouseName: count.warehouseName,
      goodId: l.goodId, goodName: l.goodName, movementType: variance > 0 ? 'adjustment_in' : 'adjustment_out',
      quantity: Math.abs(variance), unitCost: variance > 0 ? l.unitCost : null,
      movementDate: count.countDate, note: `İnventarizasiya düzəlişi (${count.id.slice(0, 6)})`,
      relatedDocumentType: 'stockCount', relatedDocumentId: count.id, performedBy: actorUid,
    });
    adjustments++;
  }
  await updateDocById('stockCounts', count.id, { status: 'completed', completedAt: new Date().toISOString() });
  await logAudit({ companyId: count.companyId, userId: actorUid, action: 'STOCK_COUNT_COMPLETED', entityType: 'stockCount', entityId: count.id, after: { adjustments } });
  return { adjustments };
}

// ── Qiymət siyahıları (05 §2, B2B) ──────────────────────────
export const listPriceLists = (companyId: string) => listByCompany<PriceList>('priceLists', companyId, [orderBy('createdAt', 'desc')]);
export const createPriceList = (d: Omit<PriceList, 'id'>) => createDoc('priceLists', d as Record<string, unknown>);
export const updatePriceList = (id: string, d: Partial<PriceList>) => updateDocById('priceLists', id, d as Record<string, unknown>);

/**
 * Qiyməti müştəri qrupu + miqdar tier-inə görə həll edir (05 §2).
 * Qrupa uyğun siyahı üstünlük təşkil edir; sonra ümumi siyahı; uyğun tier =
 * minQty ≤ qty olan ən yüksək minQty.
 */
export function resolvePrice(priceLists: PriceList[], goodId: string, customerGroupId: string | null, qty: number, fallback: number): number {
  const active = priceLists.filter((p) => p.isActive);
  const pick = (lists: PriceList[]): number | null => {
    let best: number | null = null; let bestMin = -1;
    for (const list of lists) {
      for (const e of list.entries) {
        if (e.goodId === goodId && e.minQty <= qty && e.minQty > bestMin) { best = e.price; bestMin = e.minQty; }
      }
    }
    return best;
  };
  const grouped = customerGroupId ? pick(active.filter((p) => p.customerGroupId === customerGroupId)) : null;
  if (grouped != null) return grouped;
  const general = pick(active.filter((p) => !p.customerGroupId));
  return general ?? fallback;
}

export { where };
