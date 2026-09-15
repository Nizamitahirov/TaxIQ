'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, LayoutDashboard } from 'lucide-react';
import { AREAS, areaForPath } from '@/lib/areas';
import { usePermittedNavItems } from './use-nav';
import { useTT } from '@/lib/i18n/tt';
import { cn } from '@/lib/utils/cn';

/** Mobil alt naviqasiya zolağı — sürətli sahə keçidi (faza 3) */
export function MobileTabbar() {
  const pathname = usePathname();
  const tt = useTT();
  const activeArea = areaForPath(pathname);
  const permitted = usePermittedNavItems();
  const permittedAreas = new Set(permitted.map((i) => i.area).filter(Boolean));
  const areas = AREAS.filter((a) => permittedAreas.has(a.key)).slice(0, 4);

  const item = (href: string, label: string, Icon: typeof LayoutGrid, on: boolean, gradient?: string) => (
    <Link key={href} href={href} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5">
      <span className={cn('flex h-8 w-8 items-center justify-center rounded-xl transition-colors', on ? (gradient ? `bg-gradient-to-br ${gradient} text-white` : 'bg-primary/10 text-primary') : 'text-muted-foreground')}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className={cn('max-w-[64px] truncate text-[10px] font-medium', on ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
    </Link>
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      {item('/launch', tt('Bölmələr', 'Home'), LayoutGrid, pathname === '/launch')}
      {item('/dashboard', tt('Panel', 'Panel'), LayoutDashboard, pathname === '/dashboard')}
      {areas.map((a) => item(a.landing, tt(a.label, a.labelEn).split(' ')[0], a.icon, activeArea === a.key, a.gradient))}
    </nav>
  );
}
