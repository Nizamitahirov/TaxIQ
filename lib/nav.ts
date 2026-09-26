import {
  LayoutDashboard, Building2, UserCog, ShieldCheck, ScrollText,
  Warehouse, Store, Wallet, BookOpen, BarChart3, Users2, Workflow,
  FileSpreadsheet, Settings, Layers, HardHat, ListChecks, Target, Landmark, ClipboardList, Undo2,
  FileSignature, FileText, FileMinus, Factory, Sparkles, FolderArchive, GitMerge, UserPlus, Gauge, Network, Hash, type LucideIcon,
} from 'lucide-react';
import type { ModuleKey } from '@/lib/rbac/permissions';

/** Bölmə (area) açarları — modul launcher blokları */
export type AreaKey = 'tax' | 'accounting' | 'hr' | 'hse' | 'reports' | 'settings';

export interface NavItem {
  href: string;
  labelKey: string; // messages nav.*
  icon: LucideIcon;
  module: ModuleKey;
  /** aid olduğu bölmə (modul launcher) — dashboard hər bölmədə görünür */
  area?: AreaKey;
  /** yalnız platform super admin görür */
  superAdminOnly?: boolean;
}

export interface NavGroup {
  labelKey?: string; // messages navGroup.*
  items: NavItem[];
}

/** TaxIQ sidebar naviqasiyası — modullar 1–10 */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard, module: 'dashboard' },
    ],
  },
  {
    labelKey: 'platform',
    items: [
      { href: '/companies', labelKey: 'companies', icon: Building2, module: 'companies', area: 'settings', superAdminOnly: true },
      { href: '/clients', labelKey: 'clients', icon: Users2, module: 'clients', area: 'settings' },
      { href: '/users', labelKey: 'users', icon: UserCog, module: 'users', area: 'settings' },
      { href: '/roles', labelKey: 'roles', icon: ShieldCheck, module: 'roles', area: 'settings' },
      { href: '/audit', labelKey: 'audit', icon: ScrollText, module: 'audit', area: 'settings' },
    ],
  },
  {
    // Excel: "Sənədlər" vərəqi — GRN/Despatch/Invoice/Credit-Debit Note,
    // Müqavilələr, Remittance, CMR (Alış/Satış Əməliyyatlar-a köçürülüb)
    labelKey: 'documents',
    items: [
      { href: '/crm', labelKey: 'crm', icon: Target, module: 'crm', area: 'tax' },
      { href: '/documents', labelKey: 'documents', icon: FileText, module: 'sales', area: 'tax' },
      { href: '/credit-notes', labelKey: 'creditNotes', icon: Undo2, module: 'sales', area: 'tax' },
      { href: '/debit-notes', labelKey: 'debitNotes', icon: FileMinus, module: 'cashbank', area: 'tax' },
      { href: '/contracts', labelKey: 'contracts', icon: FileSignature, module: 'sales', area: 'tax' },
    ],
  },
  {
    // Excel: "Mühasibat uçotu" — Sahələr (sektorlar) + Əməliyyatlar
    // (Bank, Kassa, Alış, Satış, Anbar, İstehsal, Əsas vəsaitlər, Qeyri-Maddi aktivlər)
    labelKey: 'accounting',
    items: [
      { href: '/accounting', labelKey: 'accounting', icon: BookOpen, module: 'accounting', area: 'accounting' },
      { href: '/sector-templates', labelKey: 'sectorTemplates', icon: Layers, module: 'companies', area: 'accounting', superAdminOnly: true },
      { href: '/cashbank', labelKey: 'cashbank', icon: Wallet, module: 'cashbank', area: 'tax' },
      { href: '/purchase-orders', labelKey: 'purchaseOrders', icon: ClipboardList, module: 'cashbank', area: 'tax' },
      { href: '/sales', labelKey: 'sales', icon: Store, module: 'sales', area: 'tax' },
      { href: '/warehouse', labelKey: 'warehouse', icon: Warehouse, module: 'warehouse', area: 'tax' },
      { href: '/production', labelKey: 'production', icon: Factory, module: 'warehouse', area: 'tax' },
      { href: '/depreciation', labelKey: 'depreciation', icon: FileSpreadsheet, module: 'accounting', area: 'accounting' },
      { href: '/intangibles', labelKey: 'intangibles', icon: Sparkles, module: 'accounting', area: 'accounting' },
    ],
  },
  {
    // Excel: "Vergi uçotu" — Bəyannamələr, Fəaliyyət kodları (+ vahid standartlar / vergi təqvimi bağlantıları səhifə içindədir)
    labelKey: 'tax',
    items: [
      { href: '/tax', labelKey: 'taxReturns', icon: Landmark, module: 'accounting', area: 'tax' },
      { href: '/activity-codes', labelKey: 'activityCodes', icon: Hash, module: 'accounting', area: 'tax' },
    ],
  },
  {
    labelKey: 'reports',
    items: [
      { href: '/ifrs', labelKey: 'ifrs', icon: BarChart3, module: 'ifrs', area: 'reports' },
      { href: '/consolidated', labelKey: 'consolidated', icon: GitMerge, module: 'ifrs', area: 'reports' },
      { href: '/budget', labelKey: 'budget', icon: Target, module: 'reports', area: 'reports' },
      { href: '/cashflow', labelKey: 'cashflow', icon: BarChart3, module: 'reports', area: 'reports' },
      { href: '/reports', labelKey: 'reports', icon: FileSpreadsheet, module: 'reports', area: 'reports' },
    ],
  },
  {
    labelKey: 'people',
    items: [
      { href: '/hr', labelKey: 'hr', icon: Users2, module: 'hr', area: 'hr' },
      { href: '/payroll', labelKey: 'payroll', icon: Wallet, module: 'payroll', area: 'hr' },
      { href: '/recruitment', labelKey: 'recruitment', icon: UserPlus, module: 'hr', area: 'hr' },
      { href: '/performance', labelKey: 'performance', icon: Gauge, module: 'hr', area: 'hr' },
      { href: '/org', labelKey: 'orgChart', icon: Network, module: 'hr', area: 'hr' },
    ],
  },
  {
    labelKey: 'hse',
    items: [
      { href: '/hse', labelKey: 'hse', icon: HardHat, module: 'hse', area: 'hse' },
    ],
  },
  {
    labelKey: 'tools',
    items: [
      { href: '/files', labelKey: 'files', icon: FolderArchive, module: 'dashboard', area: 'settings' },
      { href: '/tasks', labelKey: 'tasks', icon: ListChecks, module: 'dashboard', area: 'settings' },
      { href: '/workflow', labelKey: 'workflow', icon: Workflow, module: 'workflow', area: 'settings' },
      { href: '/settings', labelKey: 'settings', icon: Settings, module: 'settings', area: 'settings' },
    ],
  },
];
