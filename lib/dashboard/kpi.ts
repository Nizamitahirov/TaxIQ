import { where } from 'firebase/firestore';
import { listDocs, listByCompany } from '@/lib/firebase/firestore';
import type { AppUser, Company } from '@/types';

/** dailyAggregates sənədi — 03 §2.7 */
export interface DailyAggregate {
  id: string;
  companyId: string;
  date: string;
  revenue?: number;
  cogs?: number;
  expenses?: number;
  netProfit?: number;
  cashBalance?: number;
  arTotal?: number;
  apTotal?: number;
  inventoryValue?: number;
  activeEmployeeCount?: number;
  newHiresCount?: number;
  terminationsCount?: number;
}

export interface PlatformMetrics {
  companies: Company[];
  totalCompanies: number;
  activeCompanies: number;
  suspendedCompanies: number;
  totalUsers: number;
  staffUsers: number;
  clientUsers: number;
  sectorDistribution: { name: string; value: number }[];
}

const SECTOR_LABEL: Record<string, string> = {
  manufacturing: 'İstehsalat', retail: 'Retail', hospitality: 'Otelçilik',
  services: 'Xidmət', trade: 'Ticarət', construction: 'Tikinti', other: 'Digər',
};

export async function loadPlatformMetrics(): Promise<PlatformMetrics> {
  const [companies, users] = await Promise.all([
    listDocs<Company>('companies'),
    listDocs<AppUser>('users'),
  ]);
  const sectorMap = new Map<string, number>();
  for (const c of companies) {
    const label = SECTOR_LABEL[c.sector] ?? c.sector;
    sectorMap.set(label, (sectorMap.get(label) ?? 0) + 1);
  }
  return {
    companies,
    totalCompanies: companies.length,
    activeCompanies: companies.filter((c) => c.status === 'active').length,
    suspendedCompanies: companies.filter((c) => c.status === 'suspended').length,
    totalUsers: users.length,
    staffUsers: users.filter((u) => u.userType === 'staff').length,
    clientUsers: users.filter((u) => u.userType === 'client_user').length,
    sectorDistribution: Array.from(sectorMap.entries()).map(([name, value]) => ({ name, value })),
  };
}

export interface CompanyMetrics {
  latest: DailyAggregate | null;
  trend: { date: string; revenue: number; expenses: number }[];
}

/**
 * Şirkət KPI-ları — dailyAggregates-dən oxunur (03 §2.7: canlı ağır sorğu aparılmır).
 * Modul 5–10 qurulduqca bu aggregate-lər Cloud Function ilə doldurulacaq.
 */
export async function loadCompanyMetrics(companyId: string): Promise<CompanyMetrics> {
  const aggregates = await listByCompany<DailyAggregate>('dailyAggregates', companyId, [
    where('date', '>=', daysAgo(30)),
  ]);
  const sorted = aggregates.sort((a, b) => a.date.localeCompare(b.date));
  return {
    latest: sorted[sorted.length - 1] ?? null,
    trend: sorted.map((a) => ({ date: a.date.slice(5), revenue: a.revenue ?? 0, expenses: a.expenses ?? 0 })),
  };
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
