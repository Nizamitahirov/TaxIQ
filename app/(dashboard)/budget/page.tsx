'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Save, Target, Download } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { getBudget, saveBudget, BUDGET_CATEGORIES } from '@/lib/firebase/budget';
import { generateProfitLoss, yearPeriod } from '@/lib/ifrs/engine';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { exportToExcel } from '@/lib/utils/export';
import { formatCurrency } from '@/lib/utils/format';

export default function BudgetPage() {
  const tt = useTT();
  const { active, isSuperAdmin, can, profile } = useAuth();
  const companyId = active?.companyId;
  const cur = active?.company.baseCurrency ?? 'AZN';
  const canView = isSuperAdmin || can('reports.view') || can('accounting.coa.view');
  const canEdit = isSuperAdmin || can('accounting.journal.create') || can('reports.view');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [plan, setPlan] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const { data: budget } = useQuery({ queryKey: ['budget', companyId, year], queryFn: () => getBudget(companyId!, year), enabled: canView && !!companyId });
  const { data: pnl } = useQuery({ queryKey: ['pnl-budget', companyId, year], queryFn: () => generateProfitLoss(companyId!, yearPeriod(year), yearPeriod(year - 1)), enabled: canView && !!companyId });

  useEffect(() => { setPlan(budget?.plan ?? {}); }, [budget]);

  const actualByKey = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of pnl?.rows ?? []) m[r.label] = Math.abs(r.current || 0);
    return m;
  }, [pnl]);

  const rows = useMemo(() => BUDGET_CATEGORIES.map((c) => {
    const p = Number(plan[c.key]) || 0;
    const a = actualByKey[c.key] ?? 0;
    const variance = a - p;
    const pct = p > 0 ? Math.round((a / p) * 100) : 0;
    const favorable = c.kind === 'income' ? a >= p : a <= p;
    return { ...c, plan: p, actual: a, variance, pct, favorable };
  }), [plan, actualByKey]);

  const totals = useMemo(() => {
    const inc = rows.filter((r) => r.kind === 'income');
    const exp = rows.filter((r) => r.kind === 'expense');
    const sum = (arr: typeof rows, f: (r: (typeof rows)[number]) => number) => arr.reduce((s, r) => s + f(r), 0);
    return {
      planProfit: sum(inc, (r) => r.plan) - sum(exp, (r) => r.plan),
      actualProfit: sum(inc, (r) => r.actual) - sum(exp, (r) => r.actual),
    };
  }, [rows]);

  async function save() {
    setSaving(true);
    try { await saveBudget(companyId!, year, plan, profile?.uid ?? ''); toast.success(tt('Büdcə saxlanıldı', 'Budget saved')); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  if (!companyId) return <div><PageHeader title={tt('Büdcə', 'Budget')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('Büdcə', 'Budget')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader
        title={tt('Büdcə (plan-fakt)', 'Budget (plan vs actual)')}
        subtitle={tt('İllik plan qurun — fakt IFRS Mənfəət-Zərərdən avtomatik gəlir', 'Set an annual plan — actuals come automatically from the IFRS P&L')}
        action={
          <div className="flex items-end gap-2">
            <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">{tt('İl', 'Year')}</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}><SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: 5 }, (_, i) => now.getFullYear() + 1 - i).map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button variant="outline" onClick={() => exportToExcel(`budce-${year}`, [
              { header: tt('Kateqoriya', 'Category'), value: (r: typeof rows[number]) => tt(r.az, r.en) }, { header: tt('Plan', 'Plan'), value: 'plan' },
              { header: tt('Fakt', 'Actual'), value: 'actual' }, { header: tt('Fərq', 'Variance'), value: 'variance' }, { header: '%', value: 'pct' },
            ], rows)}><Download className="h-4 w-4" /> Excel</Button>
            {canEdit && <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {tt('Saxla', 'Save')}</Button>}
          </div>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card className="rounded-card"><CardContent className="flex items-center justify-between p-5">
          <div><p className="text-sm text-muted-foreground">{tt('Plan üzrə mənfəət', 'Planned profit')}</p><p className="mt-1 text-2xl font-bold">{formatCurrency(totals.planProfit, cur)}</p></div>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Target className="h-5 w-5" /></span>
        </CardContent></Card>
        <Card className="rounded-card"><CardContent className="flex items-center justify-between p-5">
          <div><p className="text-sm text-muted-foreground">{tt('Fakt üzrə mənfəət', 'Actual profit')}</p>
            <p className={`mt-1 text-2xl font-bold ${totals.actualProfit >= totals.planProfit ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(totals.actualProfit, cur)}</p></div>
          <span className="text-sm text-muted-foreground">{totals.planProfit > 0 ? `${Math.round((totals.actualProfit / totals.planProfit) * 100)}%` : '—'}</span>
        </CardContent></Card>
      </div>

      <Card className="rounded-card"><CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-secondary/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 text-left">{tt('Kateqoriya', 'Category')}</th>
              <th className="px-4 py-2.5 text-right">{tt('Plan (illik)', 'Plan (annual)')}</th>
              <th className="px-4 py-2.5 text-right">{tt('Fakt', 'Actual')}</th>
              <th className="px-4 py-2.5 text-right">{tt('Fərq', 'Variance')}</th>
              <th className="px-4 py-2.5 text-right">{tt('İcra', 'Execution')}</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2">
                    <span className="font-medium">{tt(r.az, r.en)}</span>
                    <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${r.kind === 'income' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>{r.kind === 'income' ? tt('gəlir', 'income') : tt('xərc', 'expense')}</span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    {canEdit
                      ? <Input className="ml-auto h-8 w-32 text-right tnum" type="number" value={plan[r.key] ?? ''} onChange={(e) => setPlan((p) => ({ ...p, [r.key]: Number(e.target.value) }))} />
                      : <span className="tnum">{formatCurrency(r.plan, cur)}</span>}
                  </td>
                  <td className="px-4 py-2 text-right tnum">{formatCurrency(r.actual, cur)}</td>
                  <td className={`px-4 py-2 text-right tnum ${r.favorable ? 'text-emerald-600' : 'text-rose-600'}`}>{r.variance >= 0 ? '+' : ''}{formatCurrency(r.variance, cur)}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="ml-auto flex w-28 items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${r.favorable ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, r.pct)}%` }} /></div>
                      <span className="w-9 text-right text-xs text-muted-foreground">{r.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent></Card>
      <p className="mt-3 text-xs text-muted-foreground">{tt('Fakt məbləğlər cari ilin IFRS Mənfəət-Zərər hesabatından götürülür (mütləq dəyər). Plan illik olaraq daxil edilir.', 'Actuals are taken from the current year IFRS P&L (absolute value). The plan is entered annually.')}</p>
    </div>
  );
}
