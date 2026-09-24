'use client';

/**
 * Excel idxal mühərriki (client-side, SheetJS ilə) — 02/12.
 * İstifadəçi .xlsx/.csv yükləyir → sətirlər başlıqlara görə sahələrə map olunur →
 * doğrulama (preview) → yalnız etibarlı sətirlər Firestore-a yazılır.
 * Hər varlıq üçün nümunə şablon (boş başlıqlarla) yükləmək olur.
 */
import * as XLSX from 'xlsx';
import { createDoc, listByCompany } from '@/lib/firebase/firestore';

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'enum';

export interface ImportField {
  key: string;
  az: string;
  en: string;
  type: FieldType;
  required?: boolean;
  /** enum: qəbul olunan variantlar — hər biri üçün müxtəlif etiketlər (AZ/EN/kod) */
  enumValues?: { value: string; labels: string[] }[];
  /** başlıq uyğunlaşması üçün alternativ yazılışlar */
  aliases?: string[];
  example?: string | number;
}

export interface ImportEntity {
  key: string;
  az: string;
  en: string;
  collection: string;
  fields: ImportField[];
  /** eyni sənədin təkrarını yoxlamaq üçün sahə (məs. employeeCode, sku) */
  dedupeKey?: string;
  /** sətir → Firestore sənədi */
  build: (v: Record<string, unknown>, ctx: { companyId: string; createdBy: string }) => Record<string, unknown>;
}

export interface ParsedRow {
  index: number;                       // 1-əsaslı sətir nömrəsi (başlıqdan sonra)
  values: Record<string, unknown>;     // sahə açarı → təmizlənmiş dəyər
  errors: string[];
  duplicate?: boolean;
}

// ── köməkçilər ──────────────────────────────────────────────────────────────
const norm = (s: unknown) => String(s ?? '').trim().toLocaleLowerCase('az').replace(/\s+/g, ' ');

function coerceNumber(v: unknown): number | null {
  if (typeof v === 'number') return v;
  const s = String(v ?? '').trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const TRUE_SET = new Set(['bəli', 'beli', 'hə', 'he', 'yes', 'true', '1', 'var', 'aktiv']);
const FALSE_SET = new Set(['xeyr', 'yox', 'no', 'false', '0', '']);

function coerceDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  // DD.MM.YYYY və ya DD/MM/YYYY
  const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toISOString().slice(0, 10);
}

/** Faylı oxuyub ilk vərəqin sətirlərini başlıq→dəyər obyektləri kimi qaytarır */
export async function parseSpreadsheet(file: File): Promise<{ headers: string[]; rows: Record<string, unknown>[] }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { headers: [], rows: [] };
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

/** Başlığı sahəyə uyğunlaşdırır (AZ/EN/açar/alias, reqistrsiz) */
function matchField(header: string, fields: ImportField[]): ImportField | undefined {
  const h = norm(header);
  return fields.find((f) =>
    [f.az, f.en, f.key, ...(f.aliases ?? [])].some((c) => norm(c) === h),
  );
}

/** Xam sətirləri doğrulanmış ParsedRow-lara çevirir */
export function validateRows(entity: ImportEntity, rawRows: Record<string, unknown>[], existingKeys: Set<string>): ParsedRow[] {
  // başlıq → sahə xəritəsi (ilk sətrin açarlarından)
  const sample = rawRows[0] ?? {};
  const headerToField = new Map<string, ImportField>();
  for (const header of Object.keys(sample)) {
    const f = matchField(header, entity.fields);
    if (f) headerToField.set(header, f);
  }

  const seen = new Set<string>();
  return rawRows.map((raw, i) => {
    const values: Record<string, unknown> = {};
    const errors: string[] = [];

    for (const [header, field] of headerToField) {
      const rawVal = raw[header];
      if (field.type === 'number') {
        const n = coerceNumber(rawVal);
        if (n === null && String(rawVal ?? '').trim() !== '') errors.push(`${field.az}: rəqəm deyil`);
        if (n !== null) values[field.key] = n;
      } else if (field.type === 'boolean') {
        const s = norm(rawVal);
        values[field.key] = TRUE_SET.has(s) ? true : FALSE_SET.has(s) ? false : undefined;
      } else if (field.type === 'date') {
        values[field.key] = coerceDate(rawVal);
      } else if (field.type === 'enum') {
        const s = norm(rawVal);
        if (s === '') { /* boş — default build-də */ }
        else {
          const hit = field.enumValues?.find((e) => e.labels.some((l) => norm(l) === s) || norm(e.value) === s);
          if (hit) values[field.key] = hit.value;
          else errors.push(`${field.az}: «${rawVal}» yanlış (${field.enumValues?.map((e) => e.value).join('/')})`);
        }
      } else {
        const s = String(rawVal ?? '').trim();
        if (s !== '') values[field.key] = s;
      }
    }

    // məcburi sahələr
    for (const f of entity.fields) {
      if (f.required && (values[f.key] === undefined || values[f.key] === '' || values[f.key] === null)) {
        errors.push(`${f.az}: mütləqdir`);
      }
    }

    // təkrar yoxlaması
    let duplicate = false;
    if (entity.dedupeKey && values[entity.dedupeKey] != null) {
      const k = norm(values[entity.dedupeKey]);
      if (existingKeys.has(k) || seen.has(k)) { duplicate = true; errors.push(`${entity.dedupeKey}: artıq mövcuddur (təkrar)`); }
      seen.add(k);
    }

    return { index: i + 1, values, errors, duplicate };
  });
}

/** Etibarlı sətirləri Firestore-a yazır; yaradılan sayını qaytarır */
export async function commitImport(entity: ImportEntity, rows: ParsedRow[], ctx: { companyId: string; createdBy: string }): Promise<number> {
  let n = 0;
  for (const r of rows) {
    if (r.errors.length) continue;
    await createDoc(entity.collection, entity.build(r.values, ctx));
    n++;
  }
  return n;
}

/** Mövcud dedupe açarlarını yığır (təkrarların qarşısını almaq üçün) */
export async function loadExistingKeys(entity: ImportEntity, companyId: string): Promise<Set<string>> {
  if (!entity.dedupeKey) return new Set();
  const docs = await listByCompany<Record<string, unknown>>(entity.collection, companyId);
  return new Set(docs.map((d) => norm(d[entity.dedupeKey!])).filter(Boolean));
}

/** Boş şablon (başlıqlar + bir nümunə sətir) yüklə */
export function downloadTemplate(entity: ImportEntity): void {
  const headers = entity.fields.map((f) => f.az + (f.required ? ' *' : ''));
  const example = entity.fields.map((f) => f.example ?? '');
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws['!cols'] = entity.fields.map((f) => ({ wch: Math.max(14, f.az.length + 4) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, entity.az.slice(0, 31));
  XLSX.writeFile(wb, `sablon-${entity.key}.xlsx`);
}

// ════════════════════════════════════════════════════════════════════════════
//  Varlıq tərifləri (idxal olunan master data)
// ════════════════════════════════════════════════════════════════════════════
const GENDER = [
  { value: 'male', labels: ['kişi', 'male', 'm', 'k'] },
  { value: 'female', labels: ['qadın', 'qadin', 'female', 'f', 'q'] },
];
const EMP_TYPE = [
  { value: 'full_time', labels: ['tam', 'full', 'full_time', 'tam ştat'] },
  { value: 'part_time', labels: ['yarım', 'yarim', 'part', 'part_time'] },
  { value: 'contract', labels: ['müqavilə', 'muqavile', 'contract'] },
];
const CUST_TYPE = [
  { value: 'legal_entity', labels: ['hüquqi', 'huquqi', 'legal', 'legal_entity', 'şirkət', 'sirket', 'mmc'] },
  { value: 'individual', labels: ['fiziki', 'individual', 'fərd', 'ferd'] },
];
const GOOD_TYPE = [
  { value: 'good', labels: ['mal', 'good', 'məhsul', 'mehsul', 'product'] },
  { value: 'service', labels: ['xidmət', 'xidmet', 'service'] },
];

export const IMPORT_ENTITIES: ImportEntity[] = [
  {
    key: 'employees', az: 'Əməkdaşlar', en: 'Employees', collection: 'employees', dedupeKey: 'employeeCode',
    fields: [
      { key: 'employeeCode', az: 'Tabel №', en: 'Code', type: 'string', required: true, aliases: ['kod', 'tabel', 'employee code'], example: 'EMP-101' },
      { key: 'firstName', az: 'Ad', en: 'First name', type: 'string', required: true, example: 'Nigar' },
      { key: 'lastName', az: 'Soyad', en: 'Last name', type: 'string', required: true, example: 'Əliyeva' },
      { key: 'fatherName', az: 'Ata adı', en: 'Father name', type: 'string', example: 'Əli' },
      { key: 'personalId', az: 'FİN', en: 'FIN', type: 'string', aliases: ['fin', 'şəxsiyyət'], example: '1AB2CD3' },
      { key: 'position', az: 'Vəzifə', en: 'Position', type: 'string', example: 'Mühasib' },
      { key: 'gender', az: 'Cins', en: 'Gender', type: 'enum', enumValues: GENDER, example: 'qadın' },
      { key: 'employmentType', az: 'Məşğulluq növü', en: 'Employment type', type: 'enum', enumValues: EMP_TYPE, example: 'tam' },
      { key: 'baseSalary', az: 'Vəzifə maaşı', en: 'Base salary', type: 'number', required: true, aliases: ['maaş', 'əmək haqqı'], example: 900 },
      { key: 'currency', az: 'Valyuta', en: 'Currency', type: 'string', example: 'AZN' },
      { key: 'phone', az: 'Telefon', en: 'Phone', type: 'string', example: '+994...' },
      { key: 'email', az: 'E-poçt', en: 'Email', type: 'string', example: 'ad@shirket.az' },
      { key: 'hireDate', az: 'İşə qəbul tarixi', en: 'Hire date', type: 'date', example: '2025-01-15' },
      { key: 'bankAccountIban', az: 'IBAN', en: 'IBAN', type: 'string', example: 'AZ...' },
    ],
    build: (v, ctx) => ({
      companyId: ctx.companyId, employeeCode: v.employeeCode, firstName: v.firstName, lastName: v.lastName,
      fatherName: v.fatherName ?? null, personalId: v.personalId ?? null, position: v.position ?? null,
      gender: v.gender ?? null, employmentType: v.employmentType ?? 'full_time',
      baseSalary: v.baseSalary ?? 0, currency: v.currency ?? 'AZN', phone: v.phone ?? null, email: v.email ?? null,
      hireDate: v.hireDate ?? null, bankAccountIban: v.bankAccountIban ?? null,
      status: 'active', createdBy: ctx.createdBy,
    }),
  },
  {
    key: 'customers', az: 'Müştərilər', en: 'Customers', collection: 'customers', dedupeKey: 'name',
    fields: [
      { key: 'name', az: 'Ad', en: 'Name', type: 'string', required: true, example: 'Alfa Trade MMC' },
      { key: 'type', az: 'Növ', en: 'Type', type: 'enum', enumValues: CUST_TYPE, example: 'hüquqi' },
      { key: 'taxId', az: 'VÖEN', en: 'Tax ID', type: 'string', aliases: ['voen', 'tax id'], example: '1400111111' },
      { key: 'legalName', az: 'Hüquqi ad', en: 'Legal name', type: 'string' },
      { key: 'billingAddress', az: 'Ünvan', en: 'Address', type: 'string' },
      { key: 'defaultCurrency', az: 'Valyuta', en: 'Currency', type: 'string', example: 'AZN' },
      { key: 'paymentTermDays', az: 'Ödəniş müddəti (gün)', en: 'Payment term (days)', type: 'number', example: 30 },
    ],
    build: (v, ctx) => ({
      companyId: ctx.companyId, name: v.name, type: v.type ?? 'legal_entity', taxId: v.taxId ?? null,
      legalName: v.legalName ?? null, billingAddress: v.billingAddress ?? null,
      defaultCurrency: v.defaultCurrency ?? 'AZN', paymentTermDays: v.paymentTermDays ?? 0,
      isActive: true, createdBy: ctx.createdBy,
    }),
  },
  {
    key: 'vendors', az: 'Təchizatçılar', en: 'Vendors', collection: 'vendors', dedupeKey: 'name',
    fields: [
      { key: 'name', az: 'Ad', en: 'Name', type: 'string', required: true, example: 'Beta Logistics MMC' },
      { key: 'taxId', az: 'VÖEN', en: 'Tax ID', type: 'string', aliases: ['voen'], example: '1400222222' },
      { key: 'phone', az: 'Telefon', en: 'Phone', type: 'string' },
      { key: 'email', az: 'E-poçt', en: 'Email', type: 'string' },
      { key: 'address', az: 'Ünvan', en: 'Address', type: 'string' },
      { key: 'iban', az: 'IBAN', en: 'IBAN', type: 'string' },
      { key: 'bankName', az: 'Bank', en: 'Bank', type: 'string' },
      { key: 'defaultCurrency', az: 'Valyuta', en: 'Currency', type: 'string', example: 'AZN' },
      { key: 'paymentTermDays', az: 'Ödəniş müddəti (gün)', en: 'Payment term (days)', type: 'number', example: 30 },
    ],
    build: (v, ctx) => ({
      companyId: ctx.companyId, name: v.name, taxId: v.taxId ?? null, phone: v.phone ?? null, email: v.email ?? null,
      address: v.address ?? null, iban: v.iban ?? null, bankName: v.bankName ?? null,
      defaultCurrency: v.defaultCurrency ?? 'AZN', paymentTermDays: v.paymentTermDays ?? 0, isActive: true,
    }),
  },
  {
    key: 'goods', az: 'Mal / Xidmət', en: 'Goods / Services', collection: 'goods', dedupeKey: 'sku',
    fields: [
      { key: 'sku', az: 'SKU / Kod', en: 'SKU', type: 'string', required: true, aliases: ['kod'], example: 'GD-01' },
      { key: 'name', az: 'Ad', en: 'Name', type: 'string', required: true, example: 'A4 kağız' },
      { key: 'type', az: 'Növ', en: 'Type', type: 'enum', enumValues: GOOD_TYPE, example: 'mal' },
      { key: 'barcode', az: 'Barkod', en: 'Barcode', type: 'string' },
      { key: 'baseUnit', az: 'Vahid', en: 'Unit', type: 'string', example: 'ədəd' },
      { key: 'vatRate', az: 'ƏDV %', en: 'VAT %', type: 'number', example: 18 },
      { key: 'defaultPurchasePrice', az: 'Alış qiyməti', en: 'Purchase price', type: 'number', example: 20 },
      { key: 'defaultSalePrice', az: 'Satış qiyməti', en: 'Sale price', type: 'number', example: 25 },
    ],
    build: (v, ctx) => {
      const type = (v.type as string) ?? 'good';
      const nm = String(v.name ?? '');
      return {
        companyId: ctx.companyId, sku: v.sku, name: { az: nm, en: nm }, type,
        barcode: v.barcode ?? null, baseUnit: v.baseUnit ?? 'ədəd', vatRate: v.vatRate ?? 18,
        defaultPurchasePrice: v.defaultPurchasePrice ?? null, defaultSalePrice: v.defaultSalePrice ?? null,
        trackInventory: type === 'good', isActive: true, createdBy: ctx.createdBy,
      };
    },
  },
];
