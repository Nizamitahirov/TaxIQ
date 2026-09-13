import type { LocalizedText } from '@/types';

export type FieldType = 'string' | 'number' | 'date' | 'enum';
export interface ReportField {
  key: string;
  label: LocalizedText;
  type: FieldType;
  /** iç-içə sahə üçün oxuyucu (məs. name.az) */
  accessor?: (row: Record<string, unknown>) => unknown;
}
export interface ReportableEntity {
  key: string;
  label: LocalizedText;
  collectionPath: string;
  fields: ReportField[];
}

const L = (az: string, en: string): LocalizedText => ({ az, en });
const loc = (k: string) => (row: Record<string, unknown>) => (row[k] as { az?: string })?.az ?? '';

/**
 * Metadata-əsaslı hesabat mühərriki üçün qeydiyyatdan keçmiş "reportable entity"-lər (03 §3.4).
 * Yeni modul əlavə olunanda buraya sətir əlavə etmək kifayətdir — Report Builder avtomatik tanıyır.
 */
export const REPORTABLE_ENTITIES: ReportableEntity[] = [
  {
    key: 'invoices', label: L('Fakturalar', 'Invoices'), collectionPath: 'invoices',
    fields: [
      { key: 'invoiceNumber', label: L('Faktura №', 'Invoice No'), type: 'string' },
      { key: 'customerName', label: L('Müştəri', 'Customer'), type: 'string' },
      { key: 'issueDate', label: L('Tarix', 'Date'), type: 'date' },
      { key: 'dueDate', label: L('Ödəmə tarixi', 'Due date'), type: 'date' },
      { key: 'grandTotal', label: L('Yekun', 'Total'), type: 'number' },
      { key: 'amountPaid', label: L('Ödənilib', 'Paid'), type: 'number' },
      { key: 'amountDue', label: L('Qalıq', 'Due'), type: 'number' },
      { key: 'status', label: L('Status', 'Status'), type: 'enum' },
    ],
  },
  {
    key: 'customers', label: L('Müştərilər', 'Customers'), collectionPath: 'customers',
    fields: [
      { key: 'name', label: L('Ad', 'Name'), type: 'string' },
      { key: 'taxId', label: L('VÖEN', 'Tax ID'), type: 'string' },
      { key: 'type', label: L('Tip', 'Type'), type: 'enum' },
      { key: 'paymentTermDays', label: L('Ödəniş müddəti', 'Payment term'), type: 'number' },
    ],
  },
  {
    key: 'journalEntries', label: L('Jurnal yazıları', 'Journal entries'), collectionPath: 'journalEntries',
    fields: [
      { key: 'entryNumber', label: L('Nömrə', 'Number'), type: 'string' },
      { key: 'entryDateStr', label: L('Tarix', 'Date'), type: 'date' },
      { key: 'description', label: L('Təsvir', 'Description'), type: 'string' },
      { key: 'sourceType', label: L('Mənbə', 'Source'), type: 'enum' },
      { key: 'totalDebit', label: L('Dt cəmi', 'Total debit'), type: 'number' },
      { key: 'status', label: L('Status', 'Status'), type: 'enum' },
    ],
  },
  {
    key: 'payments', label: L('Ödənişlər', 'Payments'), collectionPath: 'payments',
    fields: [
      { key: 'direction', label: L('İstiqamət', 'Direction'), type: 'enum' },
      { key: 'paymentDate', label: L('Tarix', 'Date'), type: 'date' },
      { key: 'amount', label: L('Məbləğ', 'Amount'), type: 'number' },
      { key: 'method', label: L('Metod', 'Method'), type: 'enum' },
      { key: 'status', label: L('Status', 'Status'), type: 'enum' },
    ],
  },
  {
    key: 'employees', label: L('İşçilər', 'Employees'), collectionPath: 'employees',
    fields: [
      { key: 'employeeCode', label: L('Kod', 'Code'), type: 'string' },
      { key: 'firstName', label: L('Ad', 'First name'), type: 'string' },
      { key: 'lastName', label: L('Soyad', 'Last name'), type: 'string' },
      { key: 'position', label: L('Vəzifə', 'Position'), type: 'string' },
      { key: 'status', label: L('Status', 'Status'), type: 'enum' },
    ],
  },
  {
    key: 'goods', label: L('Mal/Xidmət kataloqu', 'Goods/Services'), collectionPath: 'goods',
    fields: [
      { key: 'sku', label: L('SKU', 'SKU'), type: 'string' },
      { key: 'name', label: L('Ad', 'Name'), type: 'string', accessor: loc('name') },
      { key: 'type', label: L('Tip', 'Type'), type: 'enum' },
      { key: 'baseUnit', label: L('Vahid', 'Unit'), type: 'string' },
      { key: 'defaultSalePrice', label: L('Satış qiyməti', 'Sale price'), type: 'number' },
      { key: 'vatRate', label: L('ƏDV%', 'VAT%'), type: 'number' },
    ],
  },
  {
    key: 'purchaseBills', label: L('Kreditor fakturalar', 'Purchase bills'), collectionPath: 'purchaseBills',
    fields: [
      { key: 'billNumber', label: L('Nömrə', 'Number'), type: 'string' },
      { key: 'vendorName', label: L('Təchizatçı', 'Vendor'), type: 'string' },
      { key: 'issueDate', label: L('Tarix', 'Date'), type: 'date' },
      { key: 'grandTotal', label: L('Yekun', 'Total'), type: 'number' },
      { key: 'amountDue', label: L('Qalıq', 'Due'), type: 'number' },
      { key: 'status', label: L('Status', 'Status'), type: 'enum' },
    ],
  },
];

export const ENTITY_MAP = Object.fromEntries(REPORTABLE_ENTITIES.map((e) => [e.key, e]));

export type FilterOp = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains';
export interface ReportFilter { field: string; op: FilterOp; value: string }

export function readField(row: Record<string, unknown>, field: ReportField): unknown {
  if (field.accessor) return field.accessor(row);
  return row[field.key];
}

export function applyFilters(rows: Record<string, unknown>[], filters: ReportFilter[], fields: ReportField[]): Record<string, unknown>[] {
  if (filters.length === 0) return rows;
  const fmap = Object.fromEntries(fields.map((f) => [f.key, f]));
  return rows.filter((row) => filters.every((f) => {
    const field = fmap[f.field];
    if (!field) return true;
    const raw = readField(row, field);
    if (field.type === 'number') {
      const a = Number(raw), b = Number(f.value);
      switch (f.op) { case '=': return a === b; case '!=': return a !== b; case '>': return a > b; case '<': return a < b; case '>=': return a >= b; case '<=': return a <= b; default: return true; }
    }
    const a = String(raw ?? '').toLowerCase(), b = f.value.toLowerCase();
    switch (f.op) { case '=': return a === b; case '!=': return a !== b; case 'contains': return a.includes(b); case '>': return a > b; case '<': return a < b; case '>=': return a >= b; case '<=': return a <= b; default: return true; }
  }));
}
