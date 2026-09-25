'use client';

/** Büdcə (plan-fakt) — P&L kateqoriyaları üzrə illik plan; fakt IFRS-dən gəlir. */
import { getDocById, setDocById } from './firestore';
import { logAudit } from './audit';
import type { Budget } from '@/types';

const docId = (companyId: string, year: number) => `${companyId}__${year}`;

/** Büdcələ bilən P&L kateqoriyaları (P&L sətir adı ilə eyni açar). */
export const BUDGET_CATEGORIES: { key: string; az: string; en: string; kind: 'income' | 'expense' }[] = [
  { key: 'Xalis satış gəliri', az: 'Xalis satış gəliri', en: 'Net sales revenue', kind: 'income' },
  { key: 'Satışın maya dəyəri', az: 'Satışın maya dəyəri', en: 'Cost of sales', kind: 'expense' },
  { key: 'Kommersiya xərcləri', az: 'Kommersiya xərcləri', en: 'Selling expenses', kind: 'expense' },
  { key: 'İnzibati xərclər', az: 'İnzibati xərclər', en: 'Administrative expenses', kind: 'expense' },
  { key: 'Sair əməliyyat xərcləri', az: 'Sair əməliyyat xərcləri', en: 'Other operating expenses', kind: 'expense' },
  { key: 'Sair əməliyyat gəlirləri', az: 'Sair əməliyyat gəlirləri', en: 'Other operating income', kind: 'income' },
  { key: 'Maliyyə gəlirləri', az: 'Maliyyə gəlirləri', en: 'Finance income', kind: 'income' },
  { key: 'Maliyyə xərcləri', az: 'Maliyyə xərcləri', en: 'Finance expenses', kind: 'expense' },
];

export async function getBudget(companyId: string, year: number): Promise<Budget | null> {
  return getDocById<Budget>('budgets', docId(companyId, year));
}

export async function saveBudget(companyId: string, year: number, plan: Record<string, number>, actorUid: string): Promise<void> {
  await setDocById('budgets', docId(companyId, year), { companyId, year, plan } as Record<string, unknown>);
  await logAudit({ companyId, userId: actorUid, action: 'BUDGET_SAVED', entityType: 'budget', entityId: docId(companyId, year), after: { year } });
}
