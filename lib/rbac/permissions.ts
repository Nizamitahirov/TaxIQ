import type { LocalizedText, SystemRoleCode } from '@/types';

/**
 * TaxIQ İcazə (Permission) Kataloqu — 01 §6 / §7.
 * Format: {modul}.{alt-modul}.{əməliyyat}
 * Bütün modullar (1–10) üçün icazələr burada mərkəzi kataloqda saxlanılır ki,
 * Rol İdarəetmə matrisi avtomatik genişlənsin.
 */
export const PERMISSION_ACTIONS = [
  'view', 'create', 'edit', 'delete', 'approve', 'export', 'print', 'manage_settings',
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export interface PermissionDef {
  id: string;
  module: ModuleKey;
  label: LocalizedText;
}

/** Sidebar/naviqasiya və icazə qruplaşdırması üçün modul açarları */
export type ModuleKey =
  | 'dashboard'
  | 'platform'
  | 'companies'
  | 'users'
  | 'roles'
  | 'audit'
  | 'clients'
  | 'warehouse'
  | 'sales'
  | 'cashbank'
  | 'accounting'
  | 'ifrs'
  | 'hr'
  | 'payroll'
  | 'workflow'
  | 'reports'
  | 'settings';

export interface ModuleDef {
  key: ModuleKey;
  label: LocalizedText;
}

export const MODULES: ModuleDef[] = [
  { key: 'dashboard', label: { az: 'İdarə paneli', en: 'Dashboard' } },
  { key: 'platform', label: { az: 'Platforma', en: 'Platform' } },
  { key: 'companies', label: { az: 'Şirkətlər', en: 'Companies' } },
  { key: 'users', label: { az: 'İstifadəçilər', en: 'Users' } },
  { key: 'roles', label: { az: 'Rollar və İcazələr', en: 'Roles & Access' } },
  { key: 'audit', label: { az: 'Audit jurnalı', en: 'Audit log' } },
  { key: 'clients', label: { az: 'Müştəri qeydiyyatı', en: 'Client onboarding' } },
  { key: 'warehouse', label: { az: 'Anbar', en: 'Warehouse' } },
  { key: 'sales', label: { az: 'Satış və Faktura', en: 'Sales & Invoicing' } },
  { key: 'cashbank', label: { az: 'Kassa və Bank', en: 'Cash & Bank' } },
  { key: 'accounting', label: { az: 'Mühasibat', en: 'Accounting' } },
  { key: 'ifrs', label: { az: 'IFRS Hesabatlar', en: 'IFRS Reports' } },
  { key: 'hr', label: { az: 'İnsan Resursları', en: 'HR' } },
  { key: 'payroll', label: { az: 'Əmək haqqı', en: 'Payroll' } },
  { key: 'workflow', label: { az: 'İş axını', en: 'Workflow' } },
  { key: 'reports', label: { az: 'Hesabatlar', en: 'Reports' } },
  { key: 'settings', label: { az: 'Tənzimləmələr', en: 'Settings' } },
];

const L = (az: string, en: string): LocalizedText => ({ az, en });

/** Mərkəzi icazə kataloqu — 01 §6.1 / §7 əsasında */
export const PERMISSIONS: PermissionDef[] = [
  // Platform idarəetməsi
  { id: 'platform.users.manage', module: 'users', label: L('İstifadəçiləri idarə et', 'Manage users') },
  { id: 'platform.roles.manage', module: 'roles', label: L('Rolları idarə et', 'Manage roles') },
  { id: 'platform.company.create', module: 'companies', label: L('Şirkət yarat', 'Create company') },
  { id: 'platform.company.settings.edit', module: 'companies', label: L('Şirkət tənzimləmələrini dəyiş', 'Edit company settings') },
  { id: 'platform.audit.view', module: 'audit', label: L('Audit jurnalına bax', 'View audit log') },
  { id: 'platform.export_templates.manage', module: 'settings', label: L('Export şablonlarını idarə et', 'Manage export templates') },
  { id: 'dashboard.customize', module: 'dashboard', label: L('Paneli fərdiləşdir', 'Customize dashboard') },

  // Müştəri qeydiyyatı (Fayl 2)
  ...crud('clients.client', 'clients', L('Müştəri', 'Client')),

  // Anbar (Fayl 5)
  ...crud('warehouse.stock', 'warehouse', L('Anbar qalığı', 'Stock')),
  ...crud('warehouse.goods', 'warehouse', L('Mal/Xidmət kataloqu', 'Goods/Services')),

  // Satış & Faktura (Fayl 6)
  ...crud('sales.invoice', 'sales', L('Faktura', 'Invoice'), ['approve', 'print']),
  ...crud('sales.customer', 'sales', L('Müştəri', 'Customer')),
  ...crud('sales.order', 'sales', L('Satış sifarişi', 'Sales order')),

  // Kassa & Bank (Fayl 7)
  ...crud('cashbank.transaction', 'cashbank', L('Kassa/Bank əməliyyatı', 'Cash/Bank transaction'), ['approve']),
  { id: 'cashbank.currency.manage', module: 'cashbank', label: L('Valyuta/Məzənnə idarəsi', 'Currency/rate management') },

  // Mühasibat (Fayl 8)
  ...crud('accounting.journal', 'accounting', L('Əməliyyat jurnalı', 'Journal entry'), ['approve']),
  ...crud('accounting.coa', 'accounting', L('Hesablar planı', 'Chart of accounts')),
  { id: 'accounting.posting_rules.manage', module: 'accounting', label: L('Posting qaydalarını idarə et', 'Manage posting rules') },

  // IFRS (Fayl 9)
  { id: 'accounting.reports.ifrs.view', module: 'ifrs', label: L('IFRS hesabatlara bax', 'View IFRS reports') },
  { id: 'accounting.reports.ifrs.export', module: 'ifrs', label: L('IFRS hesabat ixracı', 'Export IFRS reports') },

  // HR (Fayl 10)
  ...crud('hr.employee', 'hr', L('İşçi', 'Employee')),
  { id: 'hr.employee.salary.view', module: 'hr', label: L('Maaş məlumatına bax (həssas)', 'View salary (sensitive)') },
  { id: 'hr.leave.view', module: 'hr', label: L('Məzuniyyətə bax', 'View leave') },
  { id: 'hr.leave.create', module: 'hr', label: L('Məzuniyyət tələbi', 'Create leave request') },
  { id: 'hr.leave.approve', module: 'hr', label: L('Məzuniyyət təsdiqi', 'Approve leave') },

  // Əmək haqqı
  ...crud('payroll.run', 'payroll', L('Əmək haqqı hesablanması', 'Payroll run'), ['approve']),

  // İş axını (Fayl 4)
  { id: 'workflow.designer.manage', module: 'workflow', label: L('İş axını dizayneri', 'Workflow designer') },

  // Hesabatlar (Fayl 3)
  { id: 'reports.builder.use', module: 'reports', label: L('Hesabat qurucusu', 'Report builder') },
  { id: 'reports.view', module: 'reports', label: L('Hesabatlara bax', 'View reports') },
];

function crud(
  prefix: string,
  module: ModuleKey,
  label: LocalizedText,
  extra: PermissionAction[] = [],
): PermissionDef[] {
  const base: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'export'];
  const actions = [...base, ...extra];
  const opLabel: Record<string, LocalizedText> = {
    view: L('bax', 'view'), create: L('yarat', 'create'), edit: L('redaktə', 'edit'),
    delete: L('sil', 'delete'), export: L('ixrac', 'export'), approve: L('təsdiq', 'approve'),
    print: L('çap', 'print'),
  };
  return actions.map((a) => ({
    id: `${prefix}.${a}`,
    module,
    label: L(`${label.az} — ${opLabel[a].az}`, `${label.en} — ${opLabel[a].en}`),
  }));
}

export const ALL_PERMISSION_IDS = PERMISSIONS.map((p) => p.id);

// ─────────────────────────────────────────────────────────────
//  Sistem rolları → icazələr — 01 §4.1
// ─────────────────────────────────────────────────────────────
const ids = (substr: string) => ALL_PERMISSION_IDS.filter((id) => id.startsWith(substr));

export interface SystemRoleDef {
  code: SystemRoleCode;
  name: LocalizedText;
  description: LocalizedText;
  /** '*' = bütün icazələr (super admin) */
  permissions: string[] | '*';
}

export const SYSTEM_ROLES: SystemRoleDef[] = [
  {
    code: 'platform_super_admin',
    name: L('Platform Super Admin', 'Platform Super Admin'),
    description: L('Bütün sistemə tam giriş, şirkət yaratma/söndürmə', 'Full system access'),
    permissions: '*',
  },
  {
    code: 'company_admin',
    name: L('Şirkət Admini', 'Company Admin'),
    description: L('Şirkət daxilində tam səlahiyyət', 'Full authority within a company'),
    permissions: [
      'platform.users.manage', 'platform.roles.manage', 'platform.company.settings.edit',
      'platform.audit.view', 'platform.export_templates.manage', 'dashboard.customize',
      ...ids('clients.'), ...ids('warehouse.'), ...ids('sales.'), ...ids('cashbank.'),
      ...ids('accounting.'), ...ids('hr.'), ...ids('payroll.'), ...ids('workflow.'), ...ids('reports.'),
    ],
  },
  {
    code: 'chief_accountant',
    name: L('Baş Mühasib', 'Chief Accountant'),
    description: L('Mühasibat, IFRS, kassa/bank tam; HR-a oxuma', 'Accounting/IFRS/treasury full; HR read'),
    permissions: [
      'dashboard.customize', 'reports.view', 'reports.builder.use',
      ...ids('accounting.'), ...ids('cashbank.'), ...ids('sales.invoice'),
      'hr.employee.view', 'hr.leave.view',
    ],
  },
  {
    code: 'accountant',
    name: L('Mühasib', 'Accountant'),
    description: L('Jurnal, faktura, kassa — yaratma/redaktə; hesabatlara oxuma', 'Journal/invoice/cash edit; reports read'),
    permissions: [
      'dashboard.customize', 'reports.view',
      'accounting.journal.view', 'accounting.journal.create', 'accounting.journal.edit', 'accounting.journal.export',
      'accounting.coa.view',
      ...ids('sales.invoice'), ...ids('cashbank.transaction'),
      'accounting.reports.ifrs.view',
    ],
  },
  {
    code: 'hr_manager',
    name: L('HR Meneceri', 'HR Manager'),
    description: L('HR modulu tam giriş', 'Full HR module access'),
    permissions: ['dashboard.customize', 'reports.view', ...ids('hr.'), ...ids('payroll.')],
  },
  {
    code: 'sales_manager',
    name: L('Satış Meneceri', 'Sales Manager'),
    description: L('Satış, faktura, müştəri tam giriş', 'Full sales/invoice/customer access'),
    permissions: ['dashboard.customize', 'reports.view', ...ids('sales.'), ...ids('warehouse.goods')],
  },
  {
    code: 'warehouse_operator',
    name: L('Anbar Operatoru', 'Warehouse Operator'),
    description: L('Anbar modulu tam giriş', 'Full warehouse access'),
    permissions: ['dashboard.customize', ...ids('warehouse.')],
  },
  {
    code: 'viewer',
    name: L('Yalnız Baxış', 'Viewer'),
    description: L('Bütün icazəli modullarda yalnız oxuma', 'Read-only across permitted modules'),
    permissions: ALL_PERMISSION_IDS.filter((id) => id.endsWith('.view')),
  },
];

export const SYSTEM_ROLE_MAP: Record<string, SystemRoleDef> = Object.fromEntries(
  SYSTEM_ROLES.map((r) => [r.code, r]),
);

/** Bir rolun effektiv icazə dəstini qaytarır ('*' super admin üçün bütün kataloq) */
export function resolveRolePermissions(role: SystemRoleDef | { permissions: string[] | '*' }): Set<string> {
  if (role.permissions === '*') return new Set(ALL_PERMISSION_IDS);
  return new Set(role.permissions);
}

/** İcazə yoxlaması — effektiv icazə dəstində permId var? */
export function hasPermission(perms: Set<string> | undefined, permId: string): boolean {
  if (!perms) return false;
  return perms.has(permId);
}

/** Modula giriş — həmin modulda ən azı bir icazə varmı? */
export function canAccessModule(perms: Set<string> | undefined, module: ModuleKey): boolean {
  if (!perms) return false;
  const modPerms = PERMISSIONS.filter((p) => p.module === module).map((p) => p.id);
  // platform/dashboard kimi modullar üçün xüsusi icazələr
  if (module === 'dashboard') return true; // panelə hər autentifikasiya olunmuş istifadəçi baxa bilər
  return modPerms.some((id) => perms.has(id));
}

/** Segregation of Duties xəbərdarlığı — eyni modulda həm create həm approve (01 §6.3) */
export function checkSoD(permissions: string[]): string[] {
  const warnings: string[] = [];
  const byPrefix = new Map<string, Set<string>>();
  for (const p of permissions) {
    const parts = p.split('.');
    const action = parts[parts.length - 1];
    const prefix = parts.slice(0, -1).join('.');
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, new Set());
    byPrefix.get(prefix)!.add(action);
  }
  for (const [prefix, actions] of byPrefix) {
    if (actions.has('create') && actions.has('approve')) warnings.push(prefix);
  }
  return warnings;
}
