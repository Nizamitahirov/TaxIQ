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
  currentBalance: number;
  isActive: boolean;
  createdAt?: TS;
  updatedAt?: TS;
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
  lastMovementAt?: TS;
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
  birthDate?: string;
  gender?: 'male' | 'female';
  phone?: string;
  email?: string;
  address?: string;
  position?: string;
  departmentId?: string | null;
  employmentType?: 'full_time' | 'part_time' | 'contract';
  hireDate?: string;
  contractNumber?: string;
  contractType?: 'indefinite' | 'fixed_term';
  contractEndDate?: string | null;
  baseSalary: number;
  currency?: string;
  bankAccountIban?: string;
  status: EmployeeStatus;
  terminationDate?: string | null;
  terminationReason?: string | null;
  laborContractNotified?: boolean;
  userId?: string | null;
  createdAt?: TS;
  updatedAt?: TS;
  createdBy?: string;
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
