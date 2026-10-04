'use client';

/** Əmlak və torpaq vergisi reyestrləri (Vergi Məcəlləsi m.197-210). */
import { listByCompany, createDoc, updateDocById, deleteDocById } from './firestore';
import { logAudit } from './audit';
import { averageAnnualValue, propertyTax, propertyAdvance, landTax } from '@/lib/tax/az-taxes';
import type { PropertyTaxAsset, LandPlot } from '@/types';

// ── Əmlak ──
export const listPropertyAssets = (companyId: string) => listByCompany<PropertyTaxAsset>('propertyTaxAssets', companyId);
export const createPropertyAsset = (d: Omit<PropertyTaxAsset, 'id'> & { createdBy: string }) => createDoc('propertyTaxAssets', d as Record<string, unknown>);
export const updatePropertyAsset = (id: string, d: Partial<PropertyTaxAsset>) => updateDocById('propertyTaxAssets', id, d as Record<string, unknown>);
export async function deletePropertyAsset(a: PropertyTaxAsset, actorUid: string): Promise<void> {
  await deleteDocById('propertyTaxAssets', a.id);
  await logAudit({ companyId: a.companyId, userId: actorUid, action: 'PROPERTY_ASSET_DELETED', entityType: 'propertyTaxAsset', entityId: a.id });
}

// ── Torpaq ──
export const listLandPlots = (companyId: string) => listByCompany<LandPlot>('landPlots', companyId);
export const createLandPlot = (d: Omit<LandPlot, 'id'> & { createdBy: string }) => createDoc('landPlots', d as Record<string, unknown>);
export const updateLandPlot = (id: string, d: Partial<LandPlot>) => updateDocById('landPlots', id, d as Record<string, unknown>);
export async function deleteLandPlot(p: LandPlot, actorUid: string): Promise<void> {
  await deleteDocById('landPlots', p.id);
  await logAudit({ companyId: p.companyId, userId: actorUid, action: 'LAND_PLOT_DELETED', entityType: 'landPlot', entityId: p.id });
}

// ── Hesablamalar ──
export interface PropertyRow extends PropertyTaxAsset { averageValue: number; tax: number; advance: number }
export function propertyRows(assets: PropertyTaxAsset[]): { rows: PropertyRow[]; totalTax: number; totalAdvance: number } {
  const rows = assets.map((a) => {
    const averageValue = averageAnnualValue(a.openingResidual, a.closingResidual);
    const tax = propertyTax(averageValue);
    return { ...a, averageValue, tax, advance: propertyAdvance(tax) };
  });
  return {
    rows,
    totalTax: Math.round(rows.reduce((s, r) => s + r.tax, 0) * 100) / 100,
    totalAdvance: Math.round(rows.reduce((s, r) => s + r.advance, 0) * 100) / 100,
  };
}

export interface LandRow extends LandPlot { tax: number }
export function landRows(plots: LandPlot[]): { rows: LandRow[]; totalTax: number } {
  const rows = plots.map((p) => ({ ...p, tax: landTax(p.areaUnits, p.tariffPerUnit) }));
  return { rows, totalTax: Math.round(rows.reduce((s, r) => s + r.tax, 0) * 100) / 100 };
}
