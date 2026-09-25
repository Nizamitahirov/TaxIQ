'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTT } from '@/lib/i18n/tt';
import { LayoutGrid, LayoutDashboard, BookOpen } from 'lucide-react';
import { NAV_GROUPS, type NavGroup } from '@/lib/nav';
import { areaForPath, areaDef, itemsForArea } from '@/lib/areas';
import { usePermittedNavItems } from './use-nav';
import { Logo } from './logo';
import { cn } from '@/lib/utils/cn';

interface Props {
  onNavigate?: () => void;
  hideHeader?: boolean;
}

export function Sidebar({ onNavigate, hideHeader = false }: Props) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tg = useTranslations('navGroup');
  const tt = useTT();
  const permittedHrefs = new Set(usePermittedNavItems().map((i) => i.href));

  const activeArea = areaForPath(pathname);
  const def = activeArea ? areaDef(activeArea) : undefined;

  // Bölmə seçilibsə yalnız həmin bölmənin elementləri; əks halda tam naviqasiya
  const groups: NavGroup[] = def
    ? [{ labelKey: undefined, items: itemsForArea(def.key).filter((i) => permittedHrefs.has(i.href)) }]
    : NAV_GROUPS
        .map((g) => ({ ...g, items: g.items.filter((i) => i.href !== '/dashboard' && permittedHrefs.has(i.href)) }))
        .filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      {!hideHeader && (
        <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-5">
          <Link href="/launch" onClick={onNavigate} aria-label="TaxIQ" className="transition-opacity hover:opacity-80">
            <Logo />
          </Link>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {/* Bölmələr (hub) + Dashboard — həmişə üstdə sabit keçidlər */}
        <ul className="space-y-0.5">
          <FixedLink href="/launch" label={tt("Bölmələr", "Workspaces")} Icon={LayoutGrid} pathname={pathname} onNavigate={onNavigate} exact />
          <FixedLink href="/dashboard" label={t('dashboard')} Icon={LayoutDashboard} pathname={pathname} onNavigate={onNavigate} exact />
        </ul>

        {def && (
          <div className="mb-1.5 mt-5 flex items-center gap-2 px-3">
            <span className={cn('flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br text-white', def.gradient)}><def.icon className="h-3.5 w-3.5" /></span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/50">{tt(def.label, def.labelEn)}</p>
          </div>
        )}

        {groups.map((group, gi) => (
          <div key={gi} className={cn(def ? (gi === 0 ? '' : 'mt-6') : 'mt-6')}>
            {!def && group.labelKey && (
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
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
                        isActive ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                      )}
                    >
                      {isActive && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
                      <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-primary' : 'text-sidebar-foreground/55 group-hover:text-sidebar-foreground')} />
                      <span className="truncate">{t(item.labelKey)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border px-3 py-3">
        <ul><FixedLink href="/guide" label={tt('İstifadəçi təlimatı', 'User guide')} Icon={BookOpen} pathname={pathname} onNavigate={onNavigate} /></ul>
      </div>
    </div>
  );
}

function FixedLink({ href, label, Icon, pathname, onNavigate, exact }: {
  href: string; label: string; Icon: typeof LayoutGrid; pathname: string; onNavigate?: () => void; exact?: boolean;
}) {
  const isActive = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'));
  return (
    <li>
      <Link href={href} onClick={onNavigate} aria-current={isActive ? 'page' : undefined}
        className={cn('group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150',
          isActive ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground')}>
        {isActive && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />}
        <Icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-primary' : 'text-sidebar-foreground/55 group-hover:text-sidebar-foreground')} />
        <span className="truncate">{label}</span>
      </Link>
    </li>
  );
}
