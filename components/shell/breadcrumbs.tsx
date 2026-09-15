'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTT } from '@/lib/i18n/tt';
import { ChevronRight } from 'lucide-react';
import { NAV_GROUPS } from '@/lib/nav';
import { areaForPath, areaDef } from '@/lib/areas';

export function Breadcrumbs() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tt = useTT();

  if (pathname === '/launch' || pathname === '/dashboard') return null;

  const navItem = NAV_GROUPS.flatMap((g) => g.items).find((i) => pathname === i.href || pathname.startsWith(i.href + '/'));
  const area = areaForPath(pathname);
  const def = area ? areaDef(area) : undefined;

  const crumbs: { label: string; href?: string }[] = [{ label: tt('Bölmələr', 'Workspaces'), href: '/launch' }];
  if (def) crumbs.push({ label: tt(def.label, def.labelEn), href: def.landing });
  if (navItem) crumbs.push({ label: t(navItem.labelKey), href: navItem.href });

  return (
    <nav aria-label="breadcrumb" className="hidden min-w-0 items-center gap-1 text-sm text-muted-foreground md:flex">
      {crumbs.map((c, i) => (
        <span key={i} className="flex min-w-0 items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />}
          {c.href && i < crumbs.length - 1 ? (
            <Link href={c.href} className="truncate transition-colors hover:text-foreground">{c.label}</Link>
          ) : (
            <span className="truncate font-medium text-foreground">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
