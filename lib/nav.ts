import {
  LayoutDashboard, Building2, UserCog, ShieldCheck, ScrollText,
  Warehouse, Store, Wallet, BookOpen, BarChart3, Users2, Workflow,
  FileSpreadsheet, Settings, Layers, HardHat, ListChecks, Target, Landmark, ClipboardList, Undo2,
  FileSignature, FileText, FileMinus, Factory, Sparkles, FolderArchive, GitMerge, UserPlus, Gauge, Network, Hash, Repeat, Ship, type LucideIcon,
} from 'lucide-react';
import type { ModuleKey } from '@/lib/rbac/permissions';

/** Bölmə (area) açarları — modul launcher blokları (məntiqli iş sahələri) */
export type AreaKey = 'sales' | 'supply' | 'accounting' | 'finance' | 'tax' | 'hr' | 'hse' | 'settings';

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

/**
 * TaxIQ sidebar naviqasiyası — məntiqli qruplaşma.
 * Hər item bir `area` (iş sahəsi) və bir nav qrupuna aiddir; ikisi uyğundur.
 */
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
    // Satış dövrü + müştəri münasibətləri (CRM burada məntiqlidir — vergidə yox)
    labelKey: 'sales',
    items: [
      { href: '/crm', labelKey: 'crm', icon: Target, module: 'crm', area: 'sales' },
      { href: '/sales', labelKey: 'sales', icon: Store, module: 'sales', area: 'sales' },
      { href: '/documents', labelKey: 'documents', icon: FileText, module: 'sales', area: 'sales' },
      { href: '/contracts', labelKey: 'contracts', icon: FileSignature, module: 'sales', area: 'sales' },
      { href: '/credit-notes', labelKey: 'creditNotes', icon: Undo2, module: 'sales', area: 'sales' },
      { href: '/debit-notes', labelKey: 'debitNotes', icon: FileMinus, module: 'cashbank', area: 'sales' },
    ],
  },
  {
    // Təchizat və anbar əməliyyatları
    labelKey: 'supply',
    items: [
      { href: '/purchase-orders', labelKey: 'purchaseOrders', icon: ClipboardList, module: 'cashbank', area: 'supply' },
      { href: '/warehouse', labelKey: 'warehouse', icon: Warehouse, module: 'warehouse', area: 'supply' },
      { href: '/production', labelKey: 'production', icon: Factory, module: 'warehouse', area: 'supply' },
      { href: '/customs', labelKey: 'customs', icon: Ship, module: 'warehouse', area: 'supply' },
    ],
  },
  {
    // Mühasibat uçotu nüvəsi
    labelKey: 'accounting',
    items: [
      { href: '/accounting', labelKey: 'accounting', icon: BookOpen, module: 'accounting', area: 'accounting' },
      { href: '/depreciation', labelKey: 'depreciation', icon: FileSpreadsheet, module: 'accounting', area: 'accounting' },
      { href: '/intangibles', labelKey: 'intangibles', icon: Sparkles, module: 'accounting', area: 'accounting' },
      { href: '/sector-templates', labelKey: 'sectorTemplates', icon: Layers, module: 'companies', area: 'accounting', superAdminOnly: true },
    ],
  },
  {
    // Maliyyə — xəzinədarlıq + maliyyə hesabatları
    labelKey: 'finance',
    items: [
      { href: '/cashbank', labelKey: 'cashbank', icon: Wallet, module: 'cashbank', area: 'finance' },
      { href: '/ifrs', labelKey: 'ifrs', icon: BarChart3, module: 'ifrs', area: 'finance' },
      { href: '/consolidated', labelKey: 'consolidated', icon: GitMerge, module: 'ifrs', area: 'finance' },
      { href: '/budget', labelKey: 'budget', icon: Target, module: 'reports', area: 'finance' },
      { href: '/cashflow', labelKey: 'cashflow', icon: BarChart3, module: 'reports', area: 'finance' },
      { href: '/reports', labelKey: 'reports', icon: FileSpreadsheet, module: 'reports', area: 'finance' },
    ],
  },
  {
    // Vergi uçotu — yalnız vergi
    labelKey: 'tax',
    items: [
      { href: '/tax', labelKey: 'taxReturns', icon: Landmark, module: 'accounting', area: 'tax' },
      { href: '/property-tax', labelKey: 'propertyTax', icon: Building2, module: 'accounting', area: 'tax' },
      { href: '/activity-codes', labelKey: 'activityCodes', icon: Hash, module: 'accounting', area: 'tax' },
    ],
  },
  {
    // Kadr və Əmək haqqı
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
      { href: '/automation', labelKey: 'automation', icon: Repeat, module: 'accounting', area: 'settings' },
      { href: '/tasks', labelKey: 'tasks', icon: ListChecks, module: 'dashboard', area: 'settings' },
      { href: '/workflow', labelKey: 'workflow', icon: Workflow, module: 'workflow', area: 'settings' },
      { href: '/settings', labelKey: 'settings', icon: Settings, module: 'settings', area: 'settings' },
    ],
  },
];
