'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PanelLeftClose, PanelLeftOpen, LayoutGrid, LayoutDashboard } from 'lucide-react';
import { NAV_GROUPS, type NavItem, type NavGroup } from '@/lib/nav';
import { areaForPath, areaDef, itemsForArea } from '@/lib/areas';
import { useAuth } from '@/components/providers/auth-provider';
import type { CompanyModule } from '@/types';
import { Logo } from './logo';
import { cn } from '@/lib/utils/cn';

// modulesEnabled ilə idarə olunan modullar (02 §2.2/§3) — qalanları platform nüvəsidir
const TOGGLEABLE = new Set<string>(['workflow', 'warehouse', 'sales', 'cashbank', 'accounting', 'ifrs', 'hr', 'payroll']);

interface Props {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ onNavigate, collapsed = false, onToggleCollapse }: Props) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tg = useTranslations('navGroup');
  const { canAccess, isSuperAdmin, active } = useAuth();
  const rawModules = (active?.company.modulesEnabled ?? []) as CompanyModule[];
  const enabledModules = new Set<string>(rawModules);
  const showAllModules = isSuperAdmin || rawModules.length === 0;

  const visible = (i: NavItem): boolean => {
    if (i.superAdminOnly) return isSuperAdmin;
    if (TOGGLEABLE.has(i.module) && !showAllModules && !enabledModules.has(i.module)) return false;
    return canAccess(i.module);
  };

  const activeArea = areaForPath(pathname);
  const def = activeArea ? areaDef(activeArea) : undefined;

  // Bölmə seçilibsə yalnız həmin bölmənin elementləri; əks halda tam naviqasiya
  let groups: NavGroup[];
  if (def) {
    groups = [{ labelKey: undefined, items: itemsForArea(def.key).filter(visible) }];
  } else {
    // Dashboard sabit keçid kimi göstərilir — qruplardan çıxarılır
    groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.href !== '/dashboard' && visible(i)) })).filter((g) => g.items.length > 0);
  }

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn('flex h-16 shrink-0 items-center border-b border-sidebar-border', collapsed ? 'justify-center px-2' : 'justify-between px-5')}>
        <Link href="/launch" onClick={onNavigate} aria-label="TaxIQ" className="transition-opacity hover:opacity-80">
          <Logo compact={collapsed} />
        </Link>
        {onToggleCollapse && !collapsed && (
          <button onClick={onToggleCollapse} className="hidden h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:flex" aria-label="Menyunu yığ" title="Menyunu yığ">
            <PanelLeftClose className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      {onToggleCollapse && collapsed && (
        <div className="flex justify-center py-3">
          <button onClick={onToggleCollapse} className="flex h-10 w-10 items-center justify-center rounded-lg text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground" aria-label="Menyunu genişləndir" title="Menyunu genişləndir">
            <PanelLeftOpen className="h-[18px] w-[18px]" />
          </button>
        </div>
      )}

      <nav className={cn('flex-1 overflow-y-auto overflow-x-hidden', collapsed ? 'px-2.5 py-2' : 'px-3 py-4')}>
        {/* Bölmələr (hub) + Dashboard — həmişə üstdə sabit keçidlər */}
        <ul className="space-y-0.5">
          <FixedLink href="/launch" label="Bölmələr" Icon={LayoutGrid} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} exact />
          <FixedLink href="/dashboard" label={t('dashboard')} Icon={LayoutDashboard} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} exact />
        </ul>

        {def && !collapsed && (
          <div className="mb-1.5 mt-5 flex items-center gap-2 px-3">
            <span className={cn('flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br text-white', def.gradient)}><def.icon className="h-3.5 w-3.5" /></span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/50">{def.label}</p>
          </div>
        )}

        {groups.map((group, gi) => (
          <div key={gi} className={cn(collapsed ? 'mt-2 border-t border-sidebar-border pt-2' : (def ? (gi === 0 ? '' : 'mt-6') : 'mt-6'))}>
            {!collapsed && !def && group.labelKey && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/40">{tg(group.labelKey)}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={collapsed ? t(item.labelKey) : undefined}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center rounded-lg text-sm font-medium transition-colors duration-150',
                        collapsed ? 'h-11 w-11 justify-center' : 'gap-3 px-3 py-2.5',
                        isActive ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                      )}
                    >
                      {isActive && !collapsed && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
                      <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-primary' : 'text-sidebar-foreground/55 group-hover:text-sidebar-foreground')} />
                      {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}

function FixedLink({ href, label, Icon, pathname, collapsed, onNavigate, exact }: {
  href: string; label: string; Icon: typeof LayoutGrid; pathname: string; collapsed: boolean; onNavigate?: () => void; exact?: boolean;
}) {
  const isActive = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'));
  return (
    <li>
      <Link href={href} onClick={onNavigate} title={collapsed ? label : undefined} aria-current={isActive ? 'page' : undefined}
        className={cn('group relative flex items-center rounded-lg text-sm font-medium transition-colors duration-150',
          collapsed ? 'h-11 w-11 justify-center' : 'gap-3 px-3 py-2.5',
          isActive ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground')}>
        {isActive && !collapsed && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
        <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-primary' : 'text-sidebar-foreground/55 group-hover:text-sidebar-foreground')} />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    </li>
  );
}
