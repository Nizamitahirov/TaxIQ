'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users2, FileText, UserRound, Package, BookOpen, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listCustomers, listInvoices } from '@/lib/firebase/sales';
import { listEmployees } from '@/lib/firebase/hr';
import { listGoods } from '@/lib/firebase/inventory';
import { listAccounts } from '@/lib/firebase/accounting';

export interface EntityResult { id: string; label: string; sublabel: string; icon: LucideIcon; href: string }

/**
 * Qlobal entity axtarışı (⌘K faza 2) — aktiv şirkətin müştəri, faktura, işçi,
 * mal və hesablarını client-side filtrləyir. Nəticələr müvafiq modula keçir.
 */
export function useEntitySearch(query: string, enabled: boolean): { results: EntityResult[]; loading: boolean } {
  const { active, canAccess, isSuperAdmin } = useAuth();
  const tt = useTT();
  const companyId = active?.companyId;
  const q = query.trim().toLowerCase();
  const on = enabled && !!companyId && q.length >= 2;

  const can = (m: Parameters<typeof canAccess>[0]) => isSuperAdmin || canAccess(m);

  // Modul səhifələri ilə eyni cache açarları — təkrar sorğu olmur
  const customers = useQuery({ queryKey: ['customers', companyId], queryFn: () => listCustomers(companyId!), enabled: on && can('sales'), staleTime: 60_000 });
  const invoices = useQuery({ queryKey: ['invoices', companyId], queryFn: () => listInvoices(companyId!), enabled: on && can('sales'), staleTime: 60_000 });
  const employees = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId!), enabled: on && can('hr'), staleTime: 60_000 });
  const goods = useQuery({ queryKey: ['goods', companyId], queryFn: () => listGoods(companyId!), enabled: on && can('warehouse'), staleTime: 60_000 });
  const accounts = useQuery({ queryKey: ['coa', companyId], queryFn: () => listAccounts(companyId!), enabled: on && can('accounting'), staleTime: 60_000 });

  const results = useMemo<EntityResult[]>(() => {
    if (!on) return [];
    const out: EntityResult[] = [];
    const take = <T,>(arr: T[] | undefined, match: (x: T) => boolean, map: (x: T) => EntityResult, limit = 5) => {
      for (const x of (arr ?? [])) { if (match(x)) { out.push(map(x)); if (out.filter((r) => r.href === map(x).href).length >= limit) break; } }
    };
    take(customers.data, (c) => c.name.toLowerCase().includes(q),
      (c) => ({ id: `cu:${c.id}`, label: c.name, sublabel: tt('Müştəri','Customer'), icon: Users2, href: '/sales' }));
    take(invoices.data, (i) => i.invoiceNumber.toLowerCase().includes(q) || (i.customerName ?? '').toLowerCase().includes(q),
      (i) => ({ id: `in:${i.id}`, label: `${i.invoiceNumber}${i.customerName ? ' — ' + i.customerName : ''}`, sublabel: tt('Faktura','Invoice'), icon: FileText, href: '/sales' }));
    take(employees.data, (e) => `${e.firstName} ${e.lastName}`.toLowerCase().includes(q),
      (e) => ({ id: `em:${e.id}`, label: `${e.firstName} ${e.lastName}`, sublabel: tt('İşçi','Employee'), icon: UserRound, href: '/hr' }));
    take(goods.data, (g) => g.name.az.toLowerCase().includes(q) || g.sku.toLowerCase().includes(q),
      (g) => ({ id: `go:${g.id}`, label: `${g.name.az}${g.sku ? ' · ' + g.sku : ''}`, sublabel: tt('Mal/Xidmət','Good/Service'), icon: Package, href: '/warehouse' }));
    take(accounts.data, (a) => a.accountCode.includes(q) || a.accountName.az.toLowerCase().includes(q),
      (a) => ({ id: `ac:${a.id}`, label: `${a.accountCode} — ${a.accountName.az}`, sublabel: tt('Hesab','Account'), icon: BookOpen, href: '/accounting' }));
    return out.slice(0, 12);
  }, [on, q, customers.data, invoices.data, employees.data, goods.data, accounts.data]);

  const loading = on && (customers.isFetching || invoices.isFetching || employees.isFetching || goods.isFetching || accounts.isFetching);
  return { results, loading };
}
