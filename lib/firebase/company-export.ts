import { listByCompany } from './firestore';
import type { WorkbookSheet } from '@/lib/utils/export';

/**
 * Şirkət-səviyyəli tam data ixracı — 02 §5.
 * Bütün biznes kolleksiyaları companyId üzrə çəkilir və çoxvərəqli iş kitabına çevrilir
 * (hər kolleksiya bir vərəq). Storage/Cloud Function tələb etmədən klientdə işləyir.
 */
const COLLECTIONS: { key: string; sheet: string }[] = [
  { key: 'chartOfAccounts', sheet: 'Hesablar Planı' },
  { key: 'journalEntries', sheet: 'Jurnal' },
  { key: 'accountingPeriods', sheet: 'Dövrlər' },
  { key: 'fixedAssets', sheet: 'Əsas Vəsaitlər' },
  { key: 'customers', sheet: 'Müştərilər' },
  { key: 'customerGroups', sheet: 'Müştəri Qrupları' },
  { key: 'salesQuotes', sheet: 'Təkliflər' },
  { key: 'salesOrders', sheet: 'Sifarişlər' },
  { key: 'invoices', sheet: 'Fakturalar' },
  { key: 'vendors', sheet: 'Təchizatçılar' },
  { key: 'purchaseBills', sheet: 'Alışlar' },
  { key: 'bankAccounts', sheet: 'Bank Hesabları' },
  { key: 'cashRegisters', sheet: 'Kassalar' },
  { key: 'cashTransactions', sheet: 'Kassa Əməliyyatları' },
  { key: 'payments', sheet: 'Ödənişlər' },
  { key: 'warehouses', sheet: 'Anbarlar' },
  { key: 'goods', sheet: 'Mal-Xidmət' },
  { key: 'goodCategories', sheet: 'Kateqoriyalar' },
  { key: 'stockBalances', sheet: 'Stok Balansı' },
  { key: 'stockMovements', sheet: 'Stok Hərəkəti' },
  { key: 'stockTransfers', sheet: 'Transferlər' },
  { key: 'employees', sheet: 'İşçilər' },
  { key: 'departments', sheet: 'Şöbələr' },
  { key: 'leaveTypes', sheet: 'Məzuniyyət Növləri' },
  { key: 'leaveRequests', sheet: 'Məzuniyyət Tələbləri' },
  { key: 'leaveBalances', sheet: 'Məzuniyyət Balansı' },
  { key: 'timePermissions', sheet: 'Saatlıq İcazələr' },
  { key: 'businessTrips', sheet: 'Ezamiyyətlər' },
  { key: 'monthlyTimesheets', sheet: 'Tabel' },
  { key: 'hrOrders', sheet: 'Kadr Əmrləri' },
  { key: 'serviceContracts', sheet: 'Xidmət Müqavilələri' },
  { key: 'payrollRuns', sheet: 'Əmək Haqqı Dövrləri' },
  { key: 'payrollAdjustments', sheet: 'Payroll Düzəlişləri' },
  { key: 'workflowDefinitions', sheet: 'İş Axınları' },
];

function cell(v: unknown): string | number | null {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'Bəli' : 'Xeyr';
  // Firestore Timestamp
  const ts = v as { toMillis?: () => number };
  if (typeof ts?.toMillis === 'function') return new Date(ts.toMillis()).toISOString().slice(0, 19).replace('T', ' ');
  try { return JSON.stringify(v); } catch { return String(v); }
}

function toSheet(name: string, docs: Record<string, unknown>[]): WorkbookSheet {
  if (docs.length === 0) return { name, headers: ['(boş)'], rows: [] };
  // Sütunlar = bütün sənədlərin açarlarının birləşməsi (id əvvəldə)
  const keys = new Set<string>(['id']);
  for (const d of docs) for (const k of Object.keys(d)) keys.add(k);
  const headers = [...keys];
  const rows = docs.map((d) => headers.map((h) => cell(d[h])));
  return { name, headers, rows };
}

export interface CompanyExportResult { sheets: WorkbookSheet[]; totalRows: number }

export async function buildCompanyExport(companyId: string): Promise<CompanyExportResult> {
  const results = await Promise.all(
    COLLECTIONS.map(async (c) => {
      try {
        const docs = await listByCompany<Record<string, unknown>>(c.key, companyId);
        return { sheet: c.sheet, docs };
      } catch {
        return { sheet: c.sheet, docs: [] as Record<string, unknown>[] };
      }
    }),
  );
  const sheets = results.map((r) => toSheet(r.sheet, r.docs));
  const totalRows = results.reduce((s, r) => s + r.docs.length, 0);
  return { sheets, totalRows };
}
