'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { NAV_GROUPS, type NavItem } from '@/lib/nav';
import type { CompanyModule } from '@/types';

const TOGGLEABLE = new Set<string>(['workflow', 'warehouse', 'sales', 'crm', 'cashbank', 'accounting', 'ifrs', 'hr', 'payroll']);

/** İcazə + aktiv modul filtrindən keçən bütün nav elementləri (shell komponentləri üçün ortaq) */
export function usePermittedNavItems(): NavItem[] {
  const { canAccess, isSuperAdmin, active } = useAuth();
  const raw = (active?.company.modulesEnabled ?? []) as CompanyModule[];
  const enabled = new Set<string>(raw);
  const showAll = isSuperAdmin || raw.length === 0;
  return NAV_GROUPS.flatMap((g) => g.items).filter((i) => {
    if (i.superAdminOnly) return isSuperAdmin;
    if (TOGGLEABLE.has(i.module) && !showAll && !enabled.has(i.module)) return false;
    return canAccess(i.module);
  });
}
