import {
  LayoutDashboard, Building2, UserCog, ShieldCheck, ScrollText,
  Warehouse, Store, Wallet, BookOpen, BarChart3, Users2, Workflow,
  FileSpreadsheet, Settings, type LucideIcon,
} from 'lucide-react';
import type { ModuleKey } from '@/lib/rbac/permissions';

export interface NavItem {
  href: string;
  labelKey: string; // messages nav.*
  icon: LucideIcon;
  module: ModuleKey;
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
      { href: '/companies', labelKey: 'companies', icon: Building2, module: 'companies', superAdminOnly: true },
      { href: '/clients', labelKey: 'clients', icon: Users2, module: 'clients' },
      { href: '/users', labelKey: 'users', icon: UserCog, module: 'users' },
      { href: '/roles', labelKey: 'roles', icon: ShieldCheck, module: 'roles' },
      { href: '/audit', labelKey: 'audit', icon: ScrollText, module: 'audit' },
    ],
  },
  {
    labelKey: 'operations',
    items: [
      { href: '/warehouse', labelKey: 'warehouse', icon: Warehouse, module: 'warehouse' },
      { href: '/sales', labelKey: 'sales', icon: Store, module: 'sales' },
      { href: '/cashbank', labelKey: 'cashbank', icon: Wallet, module: 'cashbank' },
    ],
  },
  {
    labelKey: 'finance',
    items: [
      { href: '/accounting', labelKey: 'accounting', icon: BookOpen, module: 'accounting' },
      { href: '/ifrs', labelKey: 'ifrs', icon: BarChart3, module: 'ifrs' },
    ],
  },
  {
    labelKey: 'people',
    items: [
      { href: '/hr', labelKey: 'hr', icon: Users2, module: 'hr' },
      { href: '/payroll', labelKey: 'payroll', icon: Wallet, module: 'payroll' },
    ],
  },
  {
    labelKey: 'tools',
    items: [
      { href: '/workflow', labelKey: 'workflow', icon: Workflow, module: 'workflow' },
      { href: '/reports', labelKey: 'reports', icon: FileSpreadsheet, module: 'reports' },
      { href: '/settings', labelKey: 'settings', icon: Settings, module: 'settings' },
    ],
  },
];
