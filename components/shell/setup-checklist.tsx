'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ArrowRight, Rocket, Loader2, Sparkles, X, type LucideIcon } from 'lucide-react';
import { BookOpen, Package, Users2, FileText, PenLine } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { listAccounts, initializeChartOfAccounts, listJournalEntries } from '@/lib/firebase/accounting';
import { listGoods } from '@/lib/firebase/inventory';
import { listCustomers, listInvoices } from '@/lib/firebase/sales';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import type { ModuleKey } from '@/lib/rbac/permissions';
import { cn } from '@/lib/utils/cn';

interface Step { key: string; label: string; icon: LucideIcon; module: ModuleKey; done: boolean; href: string; action?: 'initCoa' }

export function SetupChecklist() {
  const qc = useQueryClient();
  const { active, profile, canAccess, isSuperAdmin } = useAuth();
  const tt = useTT();
  const companyId = active?.companyId;
  const can = (m: ModuleKey) => isSuperAdmin || canAccess(m);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const accounts = useQuery({ queryKey: ['coa', companyId], queryFn: () => listAccounts(companyId!), enabled: !!companyId });
  const goods = useQuery({ queryKey: ['goods', companyId], queryFn: () => listGoods(companyId!), enabled: !!companyId && can('warehouse') });
  const customers = useQuery({ queryKey: ['customers', companyId], queryFn: () => listCustomers(companyId!), enabled: !!companyId && can('sales') });
  const invoices = useQuery({ queryKey: ['invoices', companyId], queryFn: () => listInvoices(companyId!), enabled: !!companyId && can('sales') });
  const journal = useQuery({ queryKey: ['journal', companyId], queryFn: () => listJournalEntries(companyId!), enabled: !!companyId && can('accounting') });

  const steps = useMemo<Step[]>(() => {
    const all: Step[] = [
      { key: 'coa', label: tt('Hesablar Planını qurun', 'Set up the chart of accounts'), icon: BookOpen, module: 'accounting', done: (accounts.data ?? []).length > 0, href: '/accounting', action: 'initCoa' },
      { key: 'goods', label: tt('İlk mal və ya xidmət əlavə edin', 'Add your first good or service'), icon: Package, module: 'warehouse', done: (goods.data ?? []).length > 0, href: '/warehouse' },
      { key: 'customer', label: tt('İlk müştərini yaradın', 'Create your first customer'), icon: Users2, module: 'sales', done: (customers.data ?? []).length > 0, href: '/sales' },
      { key: 'invoice', label: tt('İlk fakturanı kəsin', 'Issue your first invoice'), icon: FileText, module: 'sales', done: (invoices.data ?? []).length > 0, href: '/sales' },
      { key: 'journal', label: tt('İlk jurnal yazısını aparın', 'Post your first journal entry'), icon: PenLine, module: 'accounting', done: (journal.data ?? []).length > 0, href: '/accounting' },
    ];
    return all.filter((s) => can(s.module));
  }, [accounts.data, goods.data, customers.data, invoices.data, journal.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const loading = accounts.isLoading;
  const doneCount = steps.filter((s) => s.done).length;
  const pct = steps.length ? Math.round((doneCount / steps.length) * 100) : 100;

  async function initCoa() {
    if (!companyId) return;
    setBusy(true);
    try {
      const n = await initializeChartOfAccounts(companyId, profile?.uid ?? '');
      toast.success('Hesablar Planı quruldu', `${n} hesab əlavə edildi`);
      qc.invalidateQueries({ queryKey: ['coa', companyId] });
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  if (!companyId || loading || dismissed || steps.length === 0 || pct === 100) return null;

  return (
    <div className="relative mb-6 overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-soft">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      <button onClick={() => setDismissed(true)} aria-label="Bağla" className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary"><X className="h-4 w-4" /></button>
      <div className="relative flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white"><Rocket className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-bold"><Sparkles className="h-4 w-4 text-primary" /> {tt("Quraşdırmanı tamamlayın","Complete setup")}</p>
          <p className="text-xs text-muted-foreground">{doneCount}/{steps.length} {tt("addım","steps")} · {active?.company.name}</p>
        </div>
        <span className="text-2xl font-bold tnum text-primary">{pct}%</span>
      </div>
      <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="relative mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((s) => (
          <div key={s.key} className={cn('flex items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-colors', s.done ? 'border-success/30 bg-success/5' : 'border-border hover:border-primary/40')}>
            <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', s.done ? 'bg-success text-success-foreground' : 'bg-secondary text-muted-foreground')}>
              {s.done ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
            </span>
            <span className={cn('min-w-0 flex-1 truncate text-sm', s.done ? 'text-muted-foreground line-through' : 'font-medium')}>{s.label}</span>
            {!s.done && (s.action === 'initCoa'
              ? <button onClick={initCoa} disabled={busy} className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : tt('Qur', 'Set up')}</button>
              : <Link href={s.href} className="flex shrink-0 items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:bg-primary/10 hover:text-primary">{tt('Başla', 'Start')} <ArrowRight className="h-3 w-3" /></Link>)}
          </div>
        ))}
      </div>
    </div>
  );
}
