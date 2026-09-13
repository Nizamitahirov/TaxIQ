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
