'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, LayoutGrid } from 'lucide-react';
import { AREAS, areaForPath } from '@/lib/areas';
import { useTT } from '@/lib/i18n/tt';
import { usePermittedNavItems } from './use-nav';
import { Logo } from './logo';
import { cn } from '@/lib/utils/cn';

/** Dar sabit sahə zolağı (iki səviyyəli naviqasiyanın 1-ci səviyyəsi) */
export function AreaRail({ onNavigate }: { onNavigate?: () => void }) {
  const tt = useTT();
  const pathname = usePathname();
  const activeArea = areaForPath(pathname);
  const permitted = usePermittedNavItems();
  const permittedAreas = new Set(permitted.map((i) => i.area).filter(Boolean));

  const areas = AREAS.filter((a) => permittedAreas.has(a.key));

  return (
    <div className="flex h-full w-[68px] flex-col items-center gap-1 border-r border-sidebar-border bg-sidebar py-3">
      <Link href="/launch" onClick={onNavigate} title="Bölmələr" className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl transition-opacity hover:opacity-80">
        <Logo compact />
      </Link>

      <RailButton href="/launch" label="Bölmələr" active={pathname === '/launch'} onNavigate={onNavigate}>
        <LayoutGrid className="h-[18px] w-[18px]" />
      </RailButton>
      <RailButton href="/dashboard" label="Dashboard" active={pathname === '/dashboard'} onNavigate={onNavigate}>
        <LayoutDashboard className="h-[18px] w-[18px]" />
      </RailButton>

      <div className="my-1 h-px w-8 bg-sidebar-border" />

      {areas.map((a) => {
        const on = activeArea === a.key;
        const Icon = a.icon;
        return (
          <Link key={a.key} href={a.landing} onClick={onNavigate} title={tt(a.label, a.labelEn)} aria-current={on ? 'page' : undefined}
            className={cn('group relative flex h-11 w-11 items-center justify-center rounded-xl transition-all',
              on ? 'text-white shadow-md' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground')}>
            {on && <span className={cn('absolute inset-0 rounded-xl bg-gradient-to-br', a.gradient)} />}
            <span className="relative"><Icon className="h-[18px] w-[18px]" /></span>
            <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-lg group-hover:block">{tt(a.label, a.labelEn)}</span>
          </Link>
        );
      })}
    </div>
  );
}

function RailButton({ href, label, active, onNavigate, children }: { href: string; label: string; active: boolean; onNavigate?: () => void; children: React.ReactNode }) {
  return (
    <Link href={href} onClick={onNavigate} title={label} aria-current={active ? 'page' : undefined}
      className={cn('group relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
        active ? 'bg-primary/10 text-primary' : 'text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground')}>
      {children}
      <span className="pointer-events-none absolute left-full z-50 ml-2 hidden whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-lg group-hover:block">{label}</span>
    </Link>
  );
}
