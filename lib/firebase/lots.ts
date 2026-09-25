'use client';

/**
 * Partiya/Lot uçotu + son istifadə tarixi (FEFO — First-Expired-First-Out).
 * Əsas stok balansına paralel reyestr: lot-izlənən mallar üçün qəbul/sərf və
 * son istifadə tarixi nəzarəti. Cloud Functions tələb etmir.
 */
import { listByCompanySorted, createDoc, updateDocById, deleteDocById } from './firestore';
import { logAudit } from './audit';
import type { InventoryLot } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

export const listInventoryLots = (companyId: string) =>
  listByCompanySorted<InventoryLot>('inventoryLots', companyId, 'receivedDate', 'desc');

export async function receiveLot(input: {
  companyId: string; goodId: string; goodName?: string; warehouseId: string; warehouseName?: string;
  lotNumber: string; batchNumber?: string | null; expiryDate?: string | null; receivedDate: string;
  quantity: number; unitCost?: number | null; note?: string | null; createdBy: string;
}): Promise<string> {
  if (input.quantity <= 0) throw new Error('Miqdar müsbət olmalıdır');
  const id = await createDoc('inventoryLots', {
    companyId: input.companyId, goodId: input.goodId, goodName: input.goodName ?? '',
    warehouseId: input.warehouseId, warehouseName: input.warehouseName ?? '',
    lotNumber: input.lotNumber.trim(), batchNumber: input.batchNumber ?? null, expiryDate: input.expiryDate ?? null,
    receivedDate: input.receivedDate, quantityReceived: round2(input.quantity), quantityRemaining: round2(input.quantity),
    unitCost: input.unitCost ?? null, status: 'active', note: input.note ?? null, createdBy: input.createdBy,
  });
  await logAudit({ companyId: input.companyId, userId: input.createdBy, action: 'LOT_RECEIVED', entityType: 'inventoryLot', entityId: id, after: { lot: input.lotNumber, qty: input.quantity, good: input.goodName } });
  return id;
}

export interface LotConsumption { lotId: string; lotNumber: string; taken: number; expiryDate?: string | null }

/**
 * FEFO üzrə sərf: seçilmiş mal+anbar üçün ən yaxın bitmə tarixli aktiv lotlardan
 * tələb olunan miqdarı azaldır. Qalıq çatmazsa xəta atır.
 */
export async function consumeFefo(input: {
  companyId: string; goodId: string; warehouseId: string; quantity: number; lots: InventoryLot[]; actorUid: string;
}): Promise<LotConsumption[]> {
  const candidates = input.lots
    .filter((l) => l.goodId === input.goodId && l.warehouseId === input.warehouseId && l.status === 'active' && l.quantityRemaining > 0.0001)
    .sort((a, b) => {
      // Bitmə tarixi olanlar öncə (ən erkən), sonra qəbul tarixi (ən köhnə)
      const ea = a.expiryDate ?? '9999-12-31', eb = b.expiryDate ?? '9999-12-31';
      return ea === eb ? a.receivedDate.localeCompare(b.receivedDate) : ea.localeCompare(eb);
    });
  const available = round2(candidates.reduce((s, l) => s + l.quantityRemaining, 0));
  if (input.quantity > available + 0.0001) throw new Error(`Lotlarda kifayət qədər qalıq yoxdur (mövcud: ${available})`);

  const out: LotConsumption[] = [];
  let remaining = round2(input.quantity);
  for (const lot of candidates) {
    if (remaining <= 0.0001) break;
    const take = Math.min(lot.quantityRemaining, remaining);
    const newRemaining = round2(lot.quantityRemaining - take);
    await updateDocById('inventoryLots', lot.id, { quantityRemaining: newRemaining, status: newRemaining <= 0.0001 ? 'depleted' : 'active' });
    out.push({ lotId: lot.id, lotNumber: lot.lotNumber, taken: round2(take), expiryDate: lot.expiryDate ?? null });
    remaining = round2(remaining - take);
  }
  await logAudit({ companyId: input.companyId, userId: input.actorUid, action: 'LOT_CONSUMED', entityType: 'inventoryLot', entityId: input.goodId, after: { qty: input.quantity, lots: out.length } });
  return out;
}

export async function markLotExpired(lot: InventoryLot, actorUid: string): Promise<void> {
  await updateDocById('inventoryLots', lot.id, { status: 'expired' });
  await logAudit({ companyId: lot.companyId, userId: actorUid, action: 'LOT_EXPIRED', entityType: 'inventoryLot', entityId: lot.id });
}

export async function deleteLot(lot: InventoryLot, actorUid: string): Promise<void> {
  await deleteDocById('inventoryLots', lot.id);
  await logAudit({ companyId: lot.companyId, userId: actorUid, action: 'LOT_DELETED', entityType: 'inventoryLot', entityId: lot.id });
}

/** Bitmə vəziyyəti: neçə gün qalıb + statusu (bitmiş / tezliklə / normal). */
export function lotExpiry(lot: InventoryLot, today = new Date(), soonDays = 30): { daysLeft: number | null; state: 'expired' | 'soon' | 'ok' | 'none' } {
  if (!lot.expiryDate) return { daysLeft: null, state: 'none' };
  const daysLeft = Math.ceil((new Date(lot.expiryDate).getTime() - today.getTime()) / 86400000);
  if (daysLeft < 0) return { daysLeft, state: 'expired' };
  if (daysLeft <= soonDays) return { daysLeft, state: 'soon' };
  return { daysLeft, state: 'ok' };
}
