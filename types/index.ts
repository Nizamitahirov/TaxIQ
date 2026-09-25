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
  | 'viewer'
  | 'client_viewer';

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
  coverUrl?: string | null;
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
  | 'workflow' | 'warehouse' | 'sales' | 'crm' | 'cashbank' | 'accounting' | 'ifrs' | 'hr' | 'payroll';

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
  | 'manual' | 'sales_invoice' | 'sales_credit_note' | 'purchase_bill' | 'payment' | 'cash_transaction'
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

// ══════════ SƏTƏM / HSE (Modul 11) — Sağlamlıq, Əməyin Təhlükəsizliyi, Ətraf Mühit ══════════

/** hseFolders/{id} — kitabxana qovluğu */
export interface HseFolder {
  id: string;
  companyId: string;
  name: string;
  parentId?: string | null;
  createdBy?: string;
  createdAt?: TS;
}

/** hseDocuments/{id} — kitabxana faylı (Cloud Storage) */
export interface HseDocument {
  id: string;
  companyId: string;
  folderId?: string | null;
  name: string;                       // göstərilən ad
  fileName: string;                   // orijinal fayl adı
  url: string;                        // Storage download URL
  storagePath: string;                // silmək üçün
  mimeType: string;
  size: number;
  category?: string | null;           // təlimat/prosedur/sertifikat və s.
  uploadedByUid: string;
  createdAt?: TS;
}

/** hseTrainingTypes/{id} — SƏTƏM təlim növü + təkrar interval (konfiqurasiya) */
export interface HseTrainingType {
  id: string;
  companyId: string;
  name: string;
  validityMonths: number;             // neçə aydan sonra yenidən təlim tələb olunur
  isActive: boolean;
  createdAt?: TS;
}

/** hseTrainingRecords/{id} — SƏTƏM jurnalı: işçinin təlimdən keçmə + imzalı sənəd */
export interface HseTrainingRecord {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName: string;
  trainingTypeId: string;
  trainingTypeName: string;
  completedDate: string;              // "YYYY-MM-DD"
  validityMonths: number;             // qeyd anındakı interval (tarixçə)
  nextDueDate: string;                // hesablanmış: completedDate + validityMonths
  signedDocUrl?: string | null;       // scan edilmiş imzalı sənəd (Storage)
  signedDocPath?: string | null;
  signedDocUploadedAt?: string | null;
  note?: string | null;
  createdBy?: string;
  createdAt?: TS;
}

/** hseAudits/{id} — SƏTƏM auditi */
export interface HseAuditFinding {
  description: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'closed';
}
export interface HseAudit {
  id: string;
  companyId: string;
  title: string;
  auditDate: string;
  auditor: string;
  area: string;
  findings: HseAuditFinding[];
  status: 'planned' | 'in_progress' | 'completed';
  createdBy?: string;
  createdAt?: TS;
}

/** hseWorkPermits/{id} — iş icazəsi (yüksəklik, isti iş, qapalı sahə və s.) */
export interface HseWorkPermit {
  id: string;
  companyId: string;
  permitNumber: string;
  permitType: 'hot_work' | 'height' | 'confined_space' | 'electrical' | 'excavation' | 'general';
  location: string;
  description?: string | null;
  requestedBy: string;
  validFrom: string;
  validTo: string;
  status: 'draft' | 'approved' | 'active' | 'closed' | 'rejected';
  approverUid?: string | null;
  approvedAt?: string | null;
  createdBy?: string;
  createdAt?: TS;
}

/** financialStatementTemplates/{id} — 09 §1/§9. Hesabat sətirlərinin kodsuz fərdiləşdirilməsi */
export interface FinancialStatementTemplate {
  id: string;
  companyId: string;
  statementType: 'balance_sheet' | 'profit_loss' | 'cash_flow' | 'equity_changes' | 'fixed_asset_schedule';
  titleOverride?: string | null;
  showComparative?: boolean;
  renames?: Record<string, string>;
  hidden?: string[];
  updatedAt?: TS;
}

/** userTasks/{id} — tapşırıq idarəetməsi (launcher paneli + /tasks advanced) */
export type TaskStatus = 'todo' | 'in_progress' | 'done';
export interface UserTask {
  id: string;
  companyId: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  done: boolean;                   // status==='done' güzgüsü (ring/geriyə uyğunluq)
  priority: 'low' | 'medium' | 'high';
  dueDate?: string | null;         // "YYYY-MM-DD"
  labels?: string[];
  assignedToUid: string;
  assigneeName?: string | null;
  createdBy: string;
  createdByName?: string | null;
  order?: number;                  // kanban sıralaması
  createdAt?: TS;
  completedAt?: TS | null;
}

/** postingRules/{ruleId} — 08 §2.3. Hadisə → hesab kodları xəritəsi (konfiqurasiya oluna bilən) */
export type PostingEventType =
  | 'invoice_sent' | 'purchase_bill_approved' | 'payment_received' | 'payment_made'
  | 'salary_accrued' | 'salary_paid' | 'depreciation_run' | 'fx_revaluation';

export interface PostingRuleLine {
  role: string;                     // sabit slot açarı, məs. "receivable"
  label: string;                    // AZ etiket
  accountCode: string;              // dinamik hesab kodu, məs. "211"
  side: 'debit' | 'credit';
  amountSource: string;             // "grandTotal" | "subtotal" | "vatTotal" | "amount" ...
}

export interface PostingRule {
  id: string;
  companyId: string;                // şirkətə xas override
  eventType: PostingEventType;
  lines: PostingRuleLine[];
  isActive: boolean;
  createdAt?: TS;
  updatedAt?: TS;
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
  /** e-Qaimə (STS) — 06 §5 */
  eInvoice?: { submittedToSTS: boolean; stsReferenceNumber?: string | null; submittedAt?: string | null };
  documentTemplateId?: string | null;
  notes?: string | null;
  createdAt?: TS;
  updatedAt?: TS;
  createdBy?: string;
}

/** documentTemplates/{id} — Sənəd (Blank) Dizayneri, merge-tag şablonu (06 §6) */
export interface DocumentTemplate {
  id: string;
  companyId: string;
  type: 'invoice' | 'quote' | 'order' | 'contract';
  name: string;
  htmlContent: string;         // {{tag}} və {{#each lineItems}}...{{/each}} sintaksisi ilə
  isDefault: boolean;
  createdBy?: string;
  createdAt?: TS;
  updatedAt?: TS;
}

/** recurringInvoiceTemplates/{id} — Təkrarlanan fakturalar (06 §4) */
export interface RecurringInvoiceTemplate {
  id: string;
  companyId: string;
  customerId: string;
  customerName?: string;
  lineItems: DocLineItem[];
  frequency: 'monthly' | 'quarterly' | 'annually';
  nextRunDate: string;         // YYYY-MM-DD
  endDate?: string | null;
  isActive: boolean;
  lastGeneratedInvoiceId?: string | null;
  lastGeneratedAt?: string | null;
  createdBy?: string;
  createdAt?: TS;
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

// ─────────────────────────────────────────────────────────────
//  Kassa, Bank, Xəzinədarlıq — Modul 7
// ─────────────────────────────────────────────────────────────
export interface BankAccount {
  id: string;
  companyId: string;
  bankName: string;
  accountName: string;
  iban?: string;
  swiftCode?: string | null;
  currency: string;
  bankFormatProfileId?: string | null;   // 07 §1.2
  currentBalance: number;
  isActive: boolean;
  createdAt?: TS;
  updatedAt?: TS;
}

// ── Məzənnələr (01 §8 / 07 §6) ──
export interface ExchangeRate {
  id: string;                 // {currency}_{date}
  companyId: string;
  date: string;               // YYYY-MM-DD
  currency: string;           // xarici valyuta
  rate: number;               // 1 vahid xarici valyuta = rate baza valyutası
  createdAt?: TS;
}

// ── Bank fayl format profilləri (07 §1.2) ──
export interface BankFileColumn { fieldKey: string; order: number; staticValue?: string | null }
export interface BankFileFormat {
  id: string;
  companyId: string;
  bankName: string;
  fileType: 'salary_bulk' | 'payment_bulk';
  fileExtension: 'txt' | 'csv';
  delimiter: ',' | ';' | '\t';
  encoding: 'UTF-8' | 'Windows-1254' | 'CP1251';
  columns: BankFileColumn[];
  includeHeader: boolean;
  notes?: string | null;
  createdAt?: TS;
}

// ── Toplu ödəniş partiyaları (07 §4.3) ──
export interface PaymentOrderItem { beneficiaryIban: string; beneficiaryName: string; amount: number; purposeText: string; sourceType?: string | null; sourceId?: string | null }
export interface PaymentOrderBatch {
  id: string;
  companyId: string;
  bankAccountId: string;
  bankAccountName?: string;
  batchType: 'vendor_bulk' | 'salary_bulk';
  items: PaymentOrderItem[];
  totalAmount: number;
  status: 'draft' | 'exported' | 'confirmed';
  exportedAt?: string | null;
  createdBy?: string;
  createdAt?: TS;
}

// ── Bank çıxarışı idxalı + uzlaşdırma (07 §5) ──
export interface StatementLine {
  id: string;
  date: string;
  description: string;
  amount: number;             // + daxil, − çıxış
  matchStatus: 'unmatched' | 'matched' | 'ignored';
  matchedPaymentId?: string | null;
}
export interface BankStatementImport {
  id: string;
  companyId: string;
  bankAccountId: string;
  bankAccountName?: string;
  fileName: string;
  lines: StatementLine[];
  importedBy?: string;
  createdAt?: TS;
}

// ── Gündəlik kassa bağlanışı (07 §2.3) ──
export interface CashDailyClosing {
  id: string;
  companyId: string;
  cashRegisterId: string;
  cashRegisterName?: string;
  date: string;
  openingBalance: number;
  totalCashIn: number;
  totalCashOut: number;
  systemClosingBalance: number;
  physicallyCountedBalance: number;
  variance: number;
  note?: string | null;
  closedBy?: string;
  createdAt?: TS;
}

// ── Dövr sonu FX yenidən qiymətləndirmə (07 §6.3) ──
export interface RevaluedItem { itemType: 'invoice' | 'purchaseBill' | 'bankAccount'; itemId: string; label: string; currency: string; foreignAmount: number; originalRate: number; closingRate: number; unrealizedGainLoss: number }
export interface PeriodEndRevaluation {
  id: string;
  companyId: string;
  periodEndDate: string;
  revaluedItems: RevaluedItem[];
  totalUnrealizedGainLoss: number;
  journalEntryId?: string | null;
  reversed: boolean;
  createdBy?: string;
  createdAt?: TS;
}

export interface CashRegister {
  id: string;
  companyId: string;
  name: string;
  departmentId?: string | null;
  currency: string;
  currentBalance: number;
  isActive: boolean;
  createdAt?: TS;
  updatedAt?: TS;
}

export type CashTxnCategory = 'sales_receipt' | 'expense' | 'owner_contribution' | 'bank_deposit' | 'bank_withdrawal' | 'other';
export interface CashTransaction {
  id: string;
  companyId: string;
  cashRegisterId: string;
  type: 'cash_in' | 'cash_out';
  amount: number;
  currency: string;
  category: CashTxnCategory;
  relatedDocumentType?: string | null;
  relatedDocumentId?: string | null;
  transactionDate: string;
  note?: string | null;
  journalEntryId?: string | null;
  performedBy?: string;
  createdAt?: TS;
}

export interface PaymentAllocation { invoiceType: 'salesInvoice' | 'purchaseBill'; invoiceId: string; invoiceNumber?: string; allocatedAmount: number }

export interface Payment {
  id: string;
  companyId: string;
  direction: 'incoming' | 'outgoing';
  method: 'cash' | 'bank_transfer' | 'card';
  sourceAccountRef: { type: 'bank' | 'cash'; id: string };
  counterpartyRef: { type: 'customer' | 'vendor'; id: string; name?: string };
  amount: number;
  currency: string;
  exchangeRateToBaseCurrency?: number;
  paymentDate: string;
  allocations: PaymentAllocation[];
  unallocatedAmount: number;
  status: 'completed' | 'pending' | 'failed' | 'cancelled';
  journalEntryId?: string | null;
  note?: string | null;
  createdAt?: TS;
  createdBy?: string;
}

export interface Vendor {
  id: string;
  companyId: string;
  name: string;
  taxId?: string | null;
  phone?: string;
  email?: string;
  address?: string;
  iban?: string;
  bankName?: string;
  defaultCurrency?: string;
  paymentTermDays?: number;
  isRelatedParty?: boolean;
  isActive: boolean;
  createdAt?: TS;
  updatedAt?: TS;
}

// ── Büdcə (plan-fakt) — idarəetmə uçotu ──
export interface Budget {
  id?: string;
  companyId: string;
  year: number;
  /** P&L kateqoriya adı → planlaşdırılmış illik məbləğ */
  plan: Record<string, number>;
  updatedAt?: TS;
}

// ── Satınalma Sifarişi (PO) — procure-to-pay (07) ──
export type PurchaseOrderStatus = 'draft' | 'confirmed' | 'received' | 'billed' | 'cancelled';
export interface PurchaseOrder {
  id: string;
  companyId: string;
  poNumber: string;
  vendorId: string;
  vendorName?: string;
  orderDate: string;
  expectedDate?: string | null;
  lineItems: DocLineItem[];
  subtotal: number;
  vatTotal: number;
  grandTotal: number;
  currency: string;
  status: PurchaseOrderStatus;
  receivedAt?: string | null;
  billId?: string | null;         // fakturaya çevriləndə
  notes?: string | null;
  createdAt?: TS;
  updatedAt?: TS;
  createdBy?: string;
}

// ── Kredit-not (satış qaytarması) — order-to-cash (06) ──
export interface CreditNote {
  id: string;
  companyId: string;
  creditNoteNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName?: string;
  issueDate: string;
  subtotal: number;
  vatTotal: number;
  grandTotal: number;
  reason?: string | null;
  journalEntryId?: string | null;
  createdAt?: TS;
  createdBy?: string;
}

export type BillStatus = 'draft' | 'approved' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
export interface PurchaseBill {
  id: string;
  companyId: string;
  billNumber: string;
  vendorId: string;
  vendorName?: string;
  vendorInvoiceReference?: string;
  issueDate: string;
  dueDate: string;
  lineItems: DocLineItem[];
  subtotal: number;
  vatTotal: number;
  grandTotal: number;
  currency: string;
  exchangeRateToBaseCurrency?: number;
  amountPaid: number;
  amountDue: number;
  status: BillStatus;
  warehouseId?: string | null;
  journalEntryId?: string | null;
  createdAt?: TS;
  updatedAt?: TS;
  createdBy?: string;
}

// ─────────────────────────────────────────────────────────────
//  Anbar, Mal/Xidmət — Modul 5
// ─────────────────────────────────────────────────────────────
export interface GoodCategory {
  id: string;
  companyId: string;
  name: LocalizedText;
  code?: string;
  parentCategoryId?: string | null;
  isActive: boolean;
}

export interface Good {
  id: string;
  companyId: string;
  type: 'good' | 'service';
  sku: string;
  barcode?: string | null;
  name: LocalizedText;
  description?: LocalizedText;
  categoryId?: string | null;
  baseUnit: string;
  /** Alternativ vahidlər — factor = 1 alt vahiddə neçə baseUnit (05 §2, vahid çevrilməsi) */
  unitConversions?: { code: string; factor: number }[];
  trackInventory: boolean;
  valuationMethodOverride?: 'fifo' | 'weighted_average' | null;
  defaultPurchasePrice?: number | null;
  defaultSalePrice?: number | null;
  vatRate: number;
  reorderPoint?: number | null;
  reorderQuantity?: number | null;
  isActive: boolean;
  createdAt?: TS;
  updatedAt?: TS;
  createdBy?: string;
}

export interface Warehouse {
  id: string;
  companyId: string;
  name: LocalizedText;
  code: string;
  type: 'main' | 'store' | 'production' | 'virtual';
  address?: string | null;
  linkedDepartmentId?: string | null;
  isActive: boolean;
  createdAt?: TS;
  updatedAt?: TS;
}

export type MovementType =
  | 'purchase_in' | 'sale_out' | 'transfer_out' | 'transfer_in'
  | 'adjustment_in' | 'adjustment_out' | 'return_in' | 'return_out';

export interface StockMovement {
  id: string;
  companyId: string;
  warehouseId: string;
  warehouseName?: string;
  goodId: string;
  goodName?: string;
  movementType: MovementType;
  quantity: number;            // baseUnit, müsbət
  unitCost?: number | null;    // yalnız "in" hərəkətlər
  relatedDocumentType?: string | null;
  relatedDocumentId?: string | null;
  movementDate: string;        // YYYY-MM-DD
  note?: string | null;
  journalEntryId?: string | null;
  performedBy?: string;
  createdAt?: TS;
}

export interface StockBalance {
  id: string;                  // `${warehouseId}_${goodId}`
  companyId: string;
  warehouseId: string;
  goodId: string;
  quantityOnHand: number;
  averageCost: number;
  totalValue: number;
  /** FIFO qatları (yalnız fifo metodlu mallarda; ən köhnə əvvəldə) — 05 §4.2 */
  layers?: { qty: number; unitCost: number; date: string }[];
  lastMovementAt?: TS;
}

// ── İnventarizasiya (stocktake, 05 §6) ──
export interface StockCountLine {
  goodId: string;
  goodName?: string;
  systemQty: number;           // sistem qalığı (snapshot)
  countedQty: number;          // fiziki sayım
  unitCost: number;
  variance: number;            // countedQty − systemQty
}
export interface StockCount {
  id: string;
  companyId: string;
  warehouseId: string;
  warehouseName?: string;
  countDate: string;
  status: 'draft' | 'completed' | 'cancelled';
  lines: StockCountLine[];
  note?: string | null;
  createdBy?: string;
  completedAt?: string | null;
  createdAt?: TS;
}

// ── Qiymət siyahıları (05 §2, B2B qiymətlər) ──
export interface PriceListEntry {
  goodId: string;
  goodName?: string;
  minQty: number;              // bu miqdardan başlayaraq tətbiq olunur (tier)
  price: number;
}
export interface PriceList {
  id: string;
  companyId: string;
  name: string;
  customerGroupId?: string | null;   // null = ümumi siyahı
  currency: string;
  entries: PriceListEntry[];
  isActive: boolean;
  createdBy?: string;
  createdAt?: TS;
}

export interface StockTransfer {
  id: string;
  companyId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
  items: { goodId: string; goodName?: string; quantity: number }[];
  requestedBy?: string;
  shippedAt?: TS;
  receivedAt?: TS;
  createdAt?: TS;
}

// ─────────────────────────────────────────────────────────────
//  HR və Əmək Haqqı — Modul 10
// ─────────────────────────────────────────────────────────────
export type EmployeeStatus = 'active' | 'on_leave' | 'terminated';
export interface Employee {
  id: string;
  companyId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fatherName?: string;
  personalId?: string;        // FİN
  birthDate?: string | null;
  gender?: 'male' | 'female';
  phone?: string;
  email?: string;
  address?: string;
  position?: string;
  departmentId?: string | null;
  employmentType?: 'full_time' | 'part_time' | 'contract';
  /** Bu şirkət işçinin əsas iş yeridirmi? (DSMF Əlavə1 Hissə1 «Əsas iş yeri») — default Bəli */
  isPrimaryWorkplace?: boolean;
  hireDate?: string | null;
  contractNumber?: string;
  contractType?: 'indefinite' | 'fixed_term';
  contractEndDate?: string | null;
  baseSalary: number;
  currency?: string;
  bankAccountIban?: string;
  // ── Xarici əməkdaş məlumatları (DSMF Əlavə1 Hissə4) ──
  isForeigner?: boolean;
  citizenshipCountry?: string | null;
  passportSeries?: string | null;
  passportNumber?: string | null;
  residencePermitFin?: string | null;   // AR-də müvəqqəti/daimi yaşamaq icazəsi FİN
  status: EmployeeStatus;
  terminationDate?: string | null;
  terminationReason?: TerminationReason | null;
  laborContractNotified?: boolean;
  laborContractNotification?: LaborContractNotification;
  userId?: string | null;
  createdAt?: TS;
  updatedAt?: TS;
  createdBy?: string;
}

export type TerminationReason = 'resignation' | 'mutual_agreement' | 'redundancy' | 'disciplinary' | 'contract_end';

/** Elektron əmək müqaviləsi bildirişi — Əmək Məcəlləsi m.49 (10 §2.2) */
export interface LaborContractNotification {
  submittedToEGov: boolean;
  eGovReferenceNumber?: string | null;
  submittedAt?: string | null;
}

export interface LeaveType {
  id: string;
  companyId: string;
  code: string;
  name: LocalizedText;
  paid: boolean;
  defaultDays: number;
}

export interface LeaveRequest {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  leaveTypeId: string;
  leaveTypeName?: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reason?: string | null;
  createdAt?: TS;
  createdBy?: string;
}

export interface PayrollTaxConfig {
  id: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  minimumWage: number;
  incomeTaxBrackets: { uptoAmount: number | null; rate: number; fixedAmount: number }[];
  socialInsurance: { employeeBaseRate: number; employeeBaseThreshold: number; employeeRateAboveThreshold: number; employerRate: number };
  medicalInsurance: { employeeRateLowerBand: number; lowerBandThreshold: number; employeeRateUpperBand: number; employerRateLowerBand: number; employerRateUpperBand: number };
  unemploymentInsurance: { employeeRate: number; employerRate: number };
  notes?: string;
}

export interface PayrollLine {
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  overtimePay: number;
  bonuses: number;
  otherDeductions: number;
  grossSalary: number;
  incomeTax: number;
  employeeSocialInsurance: number;
  employeeMedicalInsurance: number;
  employeeUnemploymentInsurance: number;
  netSalary: number;
  employerSocialInsurance: number;
  employerMedicalInsurance: number;
  employerUnemploymentInsurance: number;
  totalEmployerCost: number;
}

export interface PayrollRun {
  id: string;
  companyId: string;
  periodMonth: number;
  periodYear: number;
  status: 'draft' | 'calculated' | 'approved' | 'paid';
  lines: PayrollLine[];
  totalGross: number;
  totalNet: number;
  totalEmployerCost: number;
  taxConfigNote?: string;
  journalEntryId?: string | null;
  approvedBy?: string | null;
  createdAt?: TS;
  createdBy?: string;
}

/** İşçi başına aylıq düzəlişlər — overtime/bonus/kəsinti (10 §6.3 addım 1) */
export interface PayrollAdjustment {
  id: string;
  companyId: string;
  employeeId: string;
  periodYear: number;
  periodMonth: number;
  overtimePay: number;
  bonuses: number;
  otherDeductions: number;
  note?: string;
  createdAt?: TS;
}

// ── Məzuniyyət balansları (10 §4.2) ──
export interface LeaveBalanceItem {
  leaveTypeId: string;
  leaveTypeName?: string;
  entitledDays: number;
  usedDays: number;
  remainingDays: number;
  carriedOver: number;
}
export interface LeaveBalance {
  id: string;              // {employeeId}_{year}
  companyId: string;
  employeeId: string;
  employeeName?: string;
  year: number;
  balances: LeaveBalanceItem[];
  updatedAt?: TS;
}

// ── Saatlıq icazə (time-off permission) ──
export type TimePermissionType = 'personal' | 'medical' | 'official' | 'other';
export interface TimePermission {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  startTime: string;       // HH:mm
  endTime: string;         // HH:mm
  hours: number;
  type: TimePermissionType;
  paid: boolean;
  reason?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: TS;
  createdBy?: string;
}

// ── Ezamiyyət (business trip) ──
export interface BusinessTrip {
  id: string;
  companyId: string;
  employeeId: string;
  employeeName?: string;
  destination: string;
  purpose: string;
  startDate: string;
  endDate: string;
  days: number;
  dailyAllowance: number;      // gündəlik norma (per diem)
  transportCost: number;
  accommodationCost: number;
  totalCost: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  orderId?: string | null;
  createdAt?: TS;
  createdBy?: string;
}

// ── İş vaxtı uçotu / Tabel (10 §5) ──
export type TimesheetDayType = 'workday' | 'weekend' | 'public_holiday';
export type TimesheetStatus = 'present' | 'absent' | 'on_leave' | 'sick';
export interface MonthlyTimesheet {
  id: string;                  // {employeeId}_{yearMonth}
  companyId: string;
  employeeId: string;
  employeeName?: string;
  yearMonth: string;           // YYYY-MM
  totalWorkedHours: number;
  totalOvertimeHours: number;
  workedDays: number;
  absenceDays: number;
  leaveDays: number;
  sickDays: number;
  status: 'draft' | 'submitted' | 'approved';
  approvedBy?: string | null;
  updatedAt?: TS;
}

// ── HR Əmrləri / decrees (əmrləşdirmə) ──
export type HROrderType =
  | 'hire' | 'termination' | 'leave' | 'business_trip'
  | 'bonus' | 'penalty' | 'transfer' | 'salary_change';
export interface HROrder {
  id: string;
  companyId: string;
  orderNumber: string;
  type: HROrderType;
  employeeId: string;
  employeeName?: string;
  orderDate: string;
  effectiveDate: string;
  title: string;
  body: string;
  meta?: Record<string, unknown>;
  status: 'draft' | 'issued' | 'cancelled';
  createdAt?: TS;
  createdBy?: string;
}

// ── Xidməti (mülki-hüquqi) müqavilə — service/civil contract ──
export interface ServiceContract {
  id: string;
  companyId: string;
  contractNumber: string;
  contractorName: string;
  contractorId?: string | null;       // FİN (fiziki) / VÖEN (hüquqi)
  contractorType: 'individual' | 'legal';
  subject: string;
  startDate: string;
  endDate?: string | null;
  amount: number;
  currency: string;
  paymentTerms?: string | null;
  withholdTax: boolean;        // ödəniş mənbəyində vergi tutulması
  status: 'draft' | 'active' | 'completed' | 'terminated';
  createdAt?: TS;
  createdBy?: string;
}

// ─────────────────────────────────────────────────────────────
//  Hesabat / Export şablonları — Modul 3 §3
// ─────────────────────────────────────────────────────────────
export interface ReportTemplateColumn {
  key: string;
  label: string;          // fərdiləşdirilmiş başlıq (adlandırma)
}
export interface ReportTemplate {
  id: string;
  companyId: string;
  name: string;
  entity: string;                       // REPORTABLE_ENTITIES açarı
  columns: ReportTemplateColumn[];      // seçim + sıra + adlandırma
  filters?: { field: string; op: string; value: string }[];
  shared: boolean;                      // şirkət daxilində paylaşılıb
  createdBy?: string;
  createdAt?: TS;
}

// ─────────────────────────────────────────────────────────────
//  Workflow Management — Modul 4
// ─────────────────────────────────────────────────────────────
export type WorkflowTriggerType = 'on_create' | 'on_update' | 'scheduled' | 'manual';
export type WorkflowActionType = 'send_notification' | 'update_field' | 'create_task' | 'generate_document';

export interface WorkflowAction {
  type: WorkflowActionType;
  config: Record<string, unknown>;
  label?: string;
}

export interface WorkflowCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'is_empty' | 'is_not_empty';
  value?: string | number;
}

export interface WorkflowApprovalStep {
  approverRoleId: string;
  mode: 'single' | 'sequential' | 'parallel';
  timeoutHours?: number;
}

/** workflowDefinitions/{workflowId} — 04 §1.3 (sadələşdirilmiş, form-əsaslı builder) */
export interface WorkflowDefinition {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  category?: 'finance' | 'hr' | 'sales' | 'general';
  status: 'draft' | 'active' | 'inactive';
  trigger: {
    type: WorkflowTriggerType;
    entityType?: string | null;
    fieldChangeFilter?: string | null;
    cron?: string | null;
  };
  conditions?: WorkflowCondition[];
  conditionLogic?: 'AND' | 'OR';
  approval?: WorkflowApprovalStep | null;
  actions: WorkflowAction[];
  version: number;
  fromTemplateId?: string | null;
  createdAt?: TS;
  updatedAt?: TS;
  createdBy?: string;
}

/** workflowRuns/{runId} — icra tarixçəsi (04 §1.4) */
export interface WorkflowRunStep {
  label: string;
  type: string;                 // condition | approval | action:<t> | trigger | terminate
  result: 'success' | 'failure' | 'pending' | 'skipped';
  detail?: string;
  at: string;                   // ISO
}
export interface WorkflowRun {
  id: string;
  companyId: string;
  workflowId: string;
  workflowName: string;
  workflowVersion: number;
  triggeredBy: { type: string; entityType?: string | null; entityId?: string | null; userId?: string | null };
  status: 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled';
  history: WorkflowRunStep[];
  startedAt?: TS;
  completedAt?: string | null;
  createdAt?: TS;
}

/** approvalTasks/{taskId} — 04 §5.3 */
export interface ApprovalTask {
  id: string;
  companyId: string;
  workflowRunId: string;
  workflowId: string;
  workflowName: string;
  approverRoleId: string;
  mode: 'single' | 'sequential' | 'parallel';
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  title: string;
  createdByUid?: string | null;        // trigger sənədini yaradan (SoD üçün)
  status: 'pending' | 'approved' | 'rejected' | 'escalated' | 'expired';
  dueAt?: string | null;
  decision?: { decidedBy: string; decidedAt: string; comment?: string | null } | null;
  createdAt?: TS;
}

/** Sistem daxili tapşırıq (create_task action nəticəsi, alert_list) */
export interface WorkflowTaskItem {
  id: string;
  companyId: string;
  workflowRunId?: string | null;
  title: string;
  assignedToUid?: string | null;
  dueDate?: string | null;
  status: 'open' | 'done';
  createdAt?: TS;
}

/** Birləşdirilmiş təsdiq/tapşırıq inbox elementi (alert_list mənbəyi, 04 §5.3 / Fayl 3) */
export interface PendingApproval {
  kind: 'leave' | 'payroll' | 'invoice_draft' | 'bill_draft';
  id: string;
  title: string;
  subtitle: string;
  amount?: number;
  currency?: string;
  link: string;
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

// ─────────────────────────────────────────────────────────────
//  CRM — Müştəri Münasibətlərinin İdarəedilməsi (Modul 13)
//  Lead → Opportunity → Quote → Customer; kontaktlar, kampaniyalar,
//  aktivlik tarixçəsi. Satış, Tapşırıq və İş axını modulları ilə bağlı.
// ─────────────────────────────────────────────────────────────
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'unqualified' | 'converted' | 'lost';
export type OpportunityStage = 'qualification' | 'needs_analysis' | 'proposal' | 'negotiation' | 'won' | 'lost';
export type LeadSource = 'website' | 'referral' | 'cold_call' | 'campaign' | 'social' | 'event' | 'partner' | 'inbound' | 'other';
export type CrmActivityType = 'note' | 'call' | 'email' | 'meeting' | 'whatsapp' | 'task' | 'stage_change' | 'status_change';
export type CrmEntityType = 'lead' | 'opportunity' | 'contact' | 'customer';

/** crmContacts/{id} — şəxs (lead və ya müştəri ilə əlaqəli) */
export interface CrmContact {
  id: string;
  companyId: string;
  firstName: string;
  lastName?: string | null;
  position?: string | null;
  organization?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  customerId?: string | null;   // mövcud müştəri ilə bağ (Satış modulu)
  leadId?: string | null;
  address?: string | null;
  notes?: string | null;
  isPrimary?: boolean;
  createdAt?: TS;
  updatedAt?: TS;
  createdBy?: string;
}

/** crmLeads/{id} — potensial müştəri (hələ ixtisaslaşdırılmayıb) */
export interface Lead {
  id: string;
  companyId: string;
  leadNumber: string;           // L-0001
  name: string;                 // təşkilat və ya şəxs adı
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  source: LeadSource;
  status: LeadStatus;
  industry?: string | null;
  estimatedValue?: number | null;
  currency?: string;
  ownerUid?: string | null;
  ownerName?: string | null;
  campaignId?: string | null;
  score?: number;               // 0–100 lead qiymətləndirmə
  nextFollowUp?: string | null; // növbəti təmas tarixi
  notes?: string | null;
  convertedToCustomerId?: string | null;
  convertedToOpportunityId?: string | null;
  lostReason?: string | null;
  createdAt?: TS;
  updatedAt?: TS;
  createdBy?: string;
}

/** crmOpportunities/{id} — ixtisaslaşdırılmış satış imkanı (pipeline) */
export interface Opportunity {
  id: string;
  companyId: string;
  opportunityNumber: string;    // O-0001
  title: string;
  customerId?: string | null;
  customerName?: string | null;
  leadId?: string | null;
  contactId?: string | null;
  stage: OpportunityStage;
  amount: number;
  currency: string;
  probability: number;          // 0–100 (mərhələyə görə avtomatik və ya əl ilə)
  expectedCloseDate?: string | null;
  source?: LeadSource | null;
  ownerUid?: string | null;
  ownerName?: string | null;
  campaignId?: string | null;
  competitors?: string | null;
  nextStep?: string | null;
  wonQuoteId?: string | null;   // Satış modulunda yaradılan təklif
  closedAt?: TS;
  closeReason?: string | null;
  createdAt?: TS;
  updatedAt?: TS;
  createdBy?: string;
}

/** crmCampaigns/{id} — marketinq kampaniyası */
export interface Campaign {
  id: string;
  companyId: string;
  name: string;
  channel: 'email' | 'social' | 'event' | 'ads' | 'referral' | 'other';
  status: 'planned' | 'active' | 'completed' | 'cancelled';
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | null;
  currency?: string;
  target?: string | null;
  notes?: string | null;
  createdAt?: TS;
  updatedAt?: TS;
  createdBy?: string;
}

/** crmActivities/{id} — aktivlik/qeyd (polimorfik bağ) */
export interface CrmActivity {
  id: string;
  companyId: string;
  type: CrmActivityType;
  entityType: CrmEntityType;
  entityId: string;
  entityLabel?: string | null;
  subject?: string | null;
  body?: string | null;
  outcome?: string | null;
  dueDate?: string | null;
  done?: boolean;
  ownerUid?: string | null;
  ownerName?: string | null;
  createdAt?: TS;
  createdBy?: string;
  createdByName?: string | null;
}
