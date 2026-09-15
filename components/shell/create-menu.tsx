'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { CREATE_ACTIONS } from '@/lib/create-actions';
import { areaForPath } from '@/lib/areas';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function CreateMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const { canAccess, isSuperAdmin } = useAuth();
  const tt = useTT();
  const area = areaForPath(pathname);

  const actions = CREATE_ACTIONS.filter((a) => isSuperAdmin || canAccess(a.module));
  if (actions.length === 0) return null;

  // Kontekst-həssas sıralama: cari sahənin əməliyyatları üstdə
  const sorted = [...actions].sort((a, b) => Number(b.area === area) - Number(a.area === area));
  const primary = sorted.filter((a) => a.area === area);
  const rest = sorted.filter((a) => a.area !== area);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">{tt("Yarat","Create")}</span></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {primary.length > 0 && <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">{tt("Bu bölmə","This workspace")}</DropdownMenuLabel>}
        {primary.map((a) => (
          <DropdownMenuItem key={a.label} onClick={() => router.push(a.href)}><a.icon className="h-4 w-4" /> {tt(a.label, a.labelEn)}</DropdownMenuItem>
        ))}
        {primary.length > 0 && rest.length > 0 && <DropdownMenuSeparator />}
        {rest.map((a) => (
          <DropdownMenuItem key={a.label} onClick={() => router.push(a.href)}><a.icon className="h-4 w-4" /> {tt(a.label, a.labelEn)}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
