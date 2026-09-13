import type { Timestamp } from 'firebase/firestore';

/** Lokalizasiya olunmuş mətn (AZ/EN) — 01 §7.3 */
export interface LocalizedText {
  az: string;
  en: string;
}

export type TS = Timestamp | { toMillis?: () => number } | number | null | undefined;

// ─────────────────────────────────────────────────────────────
//  İstifadəçi tipləri və rollar — 01 §0.2, §4
// ─────────────────────────────────────────────────────────────
export type UserType = 'platform_super_admin' | 'staff' | 'client_user';
export type UserStatus = 'active' | 'invited' | 'disabled';

/** Sistem rol kodları — 01 §4.1 */
export type SystemRoleCode =
  | 'platform_super_admin'
  | 'company_admin'
  | 'chief_accountant'
  | 'accountant'
  | 'hr_manager'
  | 'sales_manager'
  | 'warehouse_operator'
  | 'viewer';

/** users/{uid} — 01 §2.4 */
export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  userType: UserType;
  status: UserStatus;
  mustChangePassword?: boolean;
  temporaryPasswordIssuedAt?: TS;
  /** client_user üçün MƏCBURİ (yalnız 1 company); staff/super admin üçün null */
  homeCompanyId?: string | null;
  /** Denormallaşdırılmış — Security Rules sürətli yoxlaması (01 §2.4) */
  accessibleCompanyIds?: string[];
  preferredLanguage?: 'az' | 'en';
  preferredTheme?: 'light' | 'dark' | 'system';
  avatarUrl?: string | null;
  phone?: string | null;
  lastLoginAt?: TS;
  createdAt?: TS;
  updatedAt?: TS;
  createdBy?: string;
}

export type CompanyStatus = 'draft' | 'active' | 'suspended' | 'archived';
export type Sector =
  | 'manufacturing' | 'retail' | 'hospitality' | 'services'
  | 'wholesale_distribution' | 'trade' | 'construction' | 'other';

/** Modul açarları (modulesEnabled üçün) — 02 §2.2 */
export type CompanyModule =
  | 'workflow' | 'warehouse' | 'sales' | 'cashbank' | 'accounting' | 'ifrs' | 'hr' | 'payroll';

export interface CompanySettings {
  theme: 'light' | 'dark' | 'system';
  language: 'az' | 'en';
  fiscalYearStartMonth: number;
}

/** companies/{companyId} — 01 §2.3 */
export interface Company {
  id: string;
  name: string;
  legalName?: string;
  taxId?: string; // VÖEN
  sector: Sector;
  sectorTemplateId?: string;
  /** true olan YEGANƏ sənəd — TaxIQ-ın öz şirkəti (Company #1) */
  isInternal?: boolean;
  status: CompanyStatus;
  baseCurrency: string; // ISO 4217, default AZN
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  settings: CompanySettings;
  modulesEnabled?: CompanyModule[];
  // ── 02 §1.2 əlavə profil sahələri ──
  legalForm?: string;            // MMC, ASC, Fərdi Sahibkar, ...
  directorName?: string;
  brandColor?: string;           // hex — PDF başlıq zolağı üçün
  totalRooms?: number | null;    // otelçilik KPI (RevPAR/ADR) üçün
  customFieldValues?: Record<string, string | number | boolean>;
  statusReason?: string;         // son status dəyişikliyinin səbəbi (02 §6.3)
  createdAt?: TS;
  updatedAt?: TS;
  createdBy?: string;
}

/** departments/{departmentId} — 02 §4 */
export interface Department {
  id: string;
  companyId: string;
  name: LocalizedText;
  code: string;
  parentDepartmentId?: string | null;
  type: 'department' | 'cost_center' | 'project';
  isActive: boolean;
  createdAt?: TS;
  updatedAt?: TS;
}

/** companyDrafts/{draftId} — 02 §1.3 (yarımçıq qeydiyyat) */
export interface CompanyDraft {
  id: string;
  createdBy: string;
  lastStep: number;
  data: Record<string, unknown>;
  createdAt?: TS;
  updatedAt?: TS;
}

/** userCompanyAccess/{autoId} — 01 §2.5 */
export interface UserCompanyAccess {
  id: string;
  userId: string;
  companyId: string;
  roleId: string;
  customPermissionOverrides?: { add: string[]; remove: string[] };
  departmentScope?: string[] | null;
  assignedAt?: TS;
  assignedBy?: string;
  status: 'active' | 'revoked';
}

/** roles/{roleId} — 01 §4.3 */
export interface Role {
  id: string;
  name: string;
  description?: string;
  type: 'system' | 'custom';
  /** system rollar üçün null, custom üçün konkret companyId */
  companyId?: string | null;
  clonedFromRoleId?: string | null;
  /** permission ID-lərin siyahısı — 01 §6/§7 */
  permissions: string[];
  isDefaultForNewClientUser?: boolean;
  createdAt?: TS;
  updatedAt?: TS;
  createdBy?: string;
}

/** auditLogs/{autoId} — 01 §10 */
export interface AuditLog {
  id: string;
  companyId?: string | null;
  userId: string;
  userDisplayName?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress?: string;
  userAgent?: string;
  timestamp?: TS;
}

/** notifications/{autoId} — 01 §9 */
export interface Notification {
  id: string;
  userId: string;
  companyId?: string | null;
  type: string;
  title: string;
  body: string;
  link?: string;
  isRead: boolean;
  createdAt?: TS;
}

/** currencies/{isoCode} — 01 §8.1 */
export interface Currency {
  id: string;
  isoCode: string;
  name: LocalizedText;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
}

// ─────────────────────────────────────────────────────────────
//  Mühasibat Nüvəsi — Modul 8
// ─────────────────────────────────────────────────────────────
export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

/** chartOfAccounts/{accountId} — 08 §1.2 */
export interface ChartAccount {
  id: string;
  companyId: string;
  accountCode: string;              // "211", "601" — rəsmi struktur
  accountName: LocalizedText;
  accountClass: number;             // 1-9
  accountGroup: string;             // "20", "60"
  accountType: AccountType;
  normalBalance: 'debit' | 'credit';
  isPostable: boolean;              // leaf hesab (jurnal sətrində seçilə bilər)
  isSubAccount: boolean;            // Company əlavə edib
  parentAccountId?: string | null;
  currency?: string | null;
  isActive: boolean;
  isSystemAccount: boolean;         // rəsmi struktur — silinməz
  createdAt?: TS;
  updatedAt?: TS;
}

export interface JournalLine {
  accountId: string;
  accountCode?: string;
  accountName?: string;
  debit: number;
  credit: number;
  departmentId?: string | null;
  currency?: string;
  amountInBaseCurrency?: number;
}

export type JournalSourceType =
  | 'manual' | 'sales_invoice' | 'purchase_bill' | 'payment' | 'cash_transaction'
  | 'stock_movement' | 'payroll' | 'depreciation' | 'fx_revaluation';

/** journalEntries/{entryId} — 08 §2.1 */
export interface JournalEntry {
  id: string;
  companyId: string;
  entryNumber: string;
  entryDate: TS;
  entryDateStr?: string;            // "YYYY-MM-DD" (filtr/dövr üçün)
  postingPeriodId?: string;
  sourceType: JournalSourceType;
  sourceDocumentId?: string | null;
  description: string;
  lines: JournalLine[];
  totalDebit: number;
  totalCredit: number;
  status: 'posted' | 'reversed';
  reversalOfEntryId?: string | null;
  createdAt?: TS;
  createdBy?: string;
}

/** accountingPeriods/{periodId} — 08 §4.1 */
export interface AccountingPeriod {
  id: string;
  companyId: string;
  fiscalYear: number;
  periodNumber: number;             // 1-12
  periodStart: string;              // "YYYY-MM-DD"
  periodEnd: string;
  status: 'open' | 'closed';
  closedBy?: string | null;
  closedAt?: TS;
  reopenReason?: string | null;
}

/** fixedAssets/{assetId} — 08 §5.1 */
export interface FixedAsset {
  id: string;
  companyId: string;
  assetName: string;
  assetAccountId?: string;
  acquisitionDate: string;          // "YYYY-MM-DD"
  acquisitionCost: number;
  depreciationMethod: 'straight_line' | 'reducing_balance';
  usefulLifeMonths: number;
  residualValue: number;
  reducingBalanceRate?: number | null;
  accumulatedDepreciation: number;
  netBookValue: number;
  departmentId?: string | null;
  status: 'active' | 'fully_depreciated' | 'disposed';
  createdAt?: TS;
  updatedAt?: TS;
}

// ─────────────────────────────────────────────────────────────
//  Satış, Faktura — Modul 6
// ─────────────────────────────────────────────────────────────
export interface ContactPerson { name: string; phone?: string; email?: string; position?: string }

export interface Customer {
  id: string;
  companyId: string;
  type: 'individual' | 'legal_entity';
  name: string;
  legalName?: string | null;
  taxId?: string | null;
  customerGroupId?: string | null;
  contactPersons?: ContactPerson[];
  billingAddress?: string;
  shippingAddress?: string;
  defaultCurrency?: string;
  paymentTermDays?: number;
  creditLimit?: number | null;
  isRelatedParty?: boolean;   // IAS 24 (09 §6.2)
  isActive: boolean;
  createdAt?: TS;
  updatedAt?: TS;
  createdBy?: string;
}

export interface CustomerGroup {
  id: string;
  companyId: string;
  name: string;
  description?: string;
}

export interface DocLineItem {
  goodId?: string | null;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  discountPercent: number;
  vatRate: number;
  lineTotal: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string;
  companyId: string;
  invoiceNumber: string;
  customerId: string;
  customerName?: string;
  sourceOrderId?: string | null;
  issueDate: string;           // YYYY-MM-DD
  dueDate: string;
  lineItems: DocLineItem[];
  subtotal: number;
  discountTotal: number;
  vatTotal: number;
  grandTotal: number;
  currency: string;
  exchangeRateToBaseCurrency?: number;
  amountPaid: number;
  amountDue: number;
  status: InvoiceStatus;
  departmentId?: string | null;
  warehouseId?: string | null;
  journalEntryId?: string | null;
  notes?: string | null;
  createdAt?: TS;
  updatedAt?: TS;
  createdBy?: string;
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted_to_order';
export interface SalesQuote {
  id: string;
  companyId: string;
  quoteNumber: string;
  customerId: string;
  customerName?: string;
  issueDate: string;
  validUntil?: string;
  lineItems: DocLineItem[];
  subtotal: number; discountTotal: number; vatTotal: number; grandTotal: number;
  currency: string;
  status: QuoteStatus;
  notes?: string | null;
  createdAt?: TS; updatedAt?: TS; createdBy?: string;
}

export type OrderStatus = 'draft' | 'confirmed' | 'fulfilled' | 'invoiced' | 'cancelled';
export interface SalesOrder {
  id: string;
  companyId: string;
  orderNumber: string;
  customerId: string;
  customerName?: string;
  sourceQuoteId?: string | null;
  lineItems: DocLineItem[];
  subtotal: number; discountTotal: number; vatTotal: number; grandTotal: number;
  currency: string;
  fulfillmentWarehouseId?: string | null;
  status: OrderStatus;
  invoiceId?: string | null;
  createdAt?: TS; updatedAt?: TS; createdBy?: string;
}

/**
 * Aktiv membership — auth-provider-in cari company kontekstində hesabladığı
 * birləşdirilmiş giriş məlumatı (rol + effektiv icazələr).
 */
export interface ActiveMembership {
  companyId: string;
  company: Company;
  roleId: string;
  roleName: string;
  /** effektiv permission ID dəsti (rol + override) */
  permissions: Set<string>;
}
