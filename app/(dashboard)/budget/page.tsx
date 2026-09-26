'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Loader2, Save, Target, Download, SplitSquareHorizontal } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { getBudget, saveBudget, BUDGET_CATEGORIES, evenSplit } from '@/lib/firebase/budget';
import { generateProfitLoss, yearPeriod, type Period } from '@/lib/ifrs/engine';
import { listDepartments } from '@/lib/firebase/departments';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { exportToExcel } from '@/lib/utils/export';
import { formatCurrency } from '@/lib/utils/format';

const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'];
const round2 = (n: number) => Math.round(n * 100) / 100;
const netProfitOf = (rows: { label: string; current: number }[]) => rows.find((r) => r.label.toLocaleLowerCase('az').includes('xalis'))?.current ?? 0;
function monthPeriod(year: number, m: number): Period {
  const last = new Date(year, m, 0).getDate();
  return { start: `${year}-${String(m).padStart(2, '0')}-01`, end: `${year}-${String(m).padStart(2, '0')}-${last}`, label: `${MONTHS[m - 1]} ${year}` };
}

export default function BudgetPage() {
  const tt = useTT();
  const { active, isSuperAdmin, can, profile } = useAuth();
  const companyId = active?.companyId;
  const cur = active?.company.baseCurrency ?? 'AZN';
  const canView = isSuperAdmin || can('reports.view') || can('accounting.coa.view');
  const canEdit = isSuperAdmin || can('accounting.journal.create') || can('reports.view');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [view, setView] = useState('annual');
  const [plan, setPlan] = useState<Record<string, number>>({});
  const [monthlyPlan, setMonthlyPlan] = useState<Record<string, number[]>>({});
  const [departmentPlan, setDepartmentPlan] = useState<Record<string, Record<string, number>>>({});
  const [saving, setSaving] = useState(false);

  const { data: budget } = useQuery({ queryKey: ['budget', companyId, year], queryFn: () => getBudget(companyId!, year), enabled: canView && !!companyId });
  const { data: pnl } = useQuery({ queryKey: ['pnl-budget', companyId, year], queryFn: () => generateProfitLoss(companyId!, yearPeriod(year), yearPeriod(year - 1)), enabled: canView && !!companyId });
  const { data: departments } = useQuery({ queryKey: ['departments', companyId], queryFn: () => listDepartments(companyId!), enabled: canView && !!companyId && view === 'department' });

  // Aylıq fakt xalis mənfəət (12 P&L) — yalnız aylıq görünüş açılanda
  const { data: monthlyActual } = useQuery({
    queryKey: ['budget-monthly-actual', companyId, year],
    enabled: canView && !!companyId && view === 'monthly',
    queryFn: async () => {
      const out: number[] = [];
      for (let m = 1; m <= 12; m++) {
        const s = await generateProfitLoss(companyId!, monthPeriod(year, m), monthPeriod(year - 1, m));
        out.push(round2(netProfitOf(s.rows)));
      }
      return out;
    },
  });

  // Departament üzrə fakt xalis mənfəət — yalnız departament görünüşündə
  const { data: deptActual } = useQuery({
    queryKey: ['budget-dept-actual', companyId, year, (departments ?? []).map((d) => d.id).join(',')],
    enabled: canView && !!companyId && view === 'department' && (departments ?? []).length > 0,
    queryFn: async () => {
      const m: Record<string, number> = {};
      for (const d of departments ?? []) {
        const s = await generateProfitLoss(companyId!, yearPeriod(year), yearPeriod(year - 1), d.id);
        m[d.id] = round2(netProfitOf(s.rows));
      }
      return m;
    },
  });

  useEffect(() => {
    setPlan(budget?.plan ?? {});
    setMonthlyPlan(budget?.monthlyPlan ?? {});
    setDepartmentPlan(budget?.departmentPlan ?? {});
  }, [budget]);

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
    return { planProfit: sum(inc, (r) => r.plan) - sum(exp, (r) => r.plan), actualProfit: sum(inc, (r) => r.actual) - sum(exp, (r) => r.actual) };
  }, [rows]);

  /** Aylıq plan xalis mənfəət (gəlir kateqoriyaları − xərc kateqoriyaları, aylıq). */
  const monthlyPlanProfit = useMemo(() => Array.from({ length: 12 }, (_, i) =>
    round2(BUDGET_CATEGORIES.reduce((s, c) => {
      const v = (monthlyPlan[c.key]?.[i]) ?? 0;
      return s + (c.kind === 'income' ? v : -v);
    }, 0))
  ), [monthlyPlan]);

  const monthlyChart = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
    label: MONTHS[i], plan: monthlyPlanProfit[i], actual: round2(monthlyActual?.[i] ?? 0),
  })), [monthlyPlanProfit, monthlyActual]);

  function setMonth(key: string, i: number, v: number) {
    setMonthlyPlan((mp) => {
      const arr = [...(mp[key] ?? Array(12).fill(0))];
      arr[i] = v;
      return { ...mp, [key]: arr };
    });
  }
  function splitFromAnnual(key: string) {
    setMonthlyPlan((mp) => ({ ...mp, [key]: evenSplit(Number(plan[key]) || 0) }));
  }
  function setDeptPlan(deptId: string, v: number) {
    setDepartmentPlan((dp) => ({ ...dp, [deptId]: { ...(dp[deptId] ?? {}), __profit: v } }));
  }

  async function save() {
    setSaving(true);
    try { await saveBudget(companyId!, year, { plan, monthlyPlan, departmentPlan }, profile?.uid ?? ''); toast.success(tt('Büdcə saxlanıldı', 'Budget saved')); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  if (!companyId) return <div><PageHeader title={tt('Büdcə', 'Budget')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('Büdcə', 'Budget')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader
        title={tt('Büdcə (plan-fakt)', 'Budget (plan vs actual)')}
        subtitle={tt('İllik/aylıq plan və departament üzrə bölgü — fakt IFRS-dən avtomatik', 'Annual/monthly plan and per-department split — actuals from the IFRS P&L')}
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

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="annual">{tt('İllik', 'Annual')}</TabsTrigger>
          <TabsTrigger value="monthly">{tt('Aylıq', 'Monthly')}</TabsTrigger>
          <TabsTrigger value="department">{tt('Departament üzrə', 'By department')}</TabsTrigger>
        </TabsList>

        {/* ── İllik ── */}
        <TabsContent value="annual" className="mt-4">
          <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-secondary/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 text-left">{tt('Kateqoriya', 'Category')}</th><th className="px-4 py-2.5 text-right">{tt('Plan (illik)', 'Plan (annual)')}</th>
                <th className="px-4 py-2.5 text-right">{tt('Fakt', 'Actual')}</th><th className="px-4 py-2.5 text-right">{tt('Fərq', 'Variance')}</th><th className="px-4 py-2.5 text-right">{tt('İcra', 'Execution')}</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.key} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2"><span className="font-medium">{tt(r.az, r.en)}</span>
                      <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] ${r.kind === 'income' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>{r.kind === 'income' ? tt('gəlir', 'income') : tt('xərc', 'expense')}</span></td>
                    <td className="px-4 py-2 text-right">{canEdit
                      ? <Input className="ml-auto h-8 w-32 text-right tnum" type="number" value={plan[r.key] ?? ''} onChange={(e) => setPlan((p) => ({ ...p, [r.key]: Number(e.target.value) }))} />
                      : <span className="tnum">{formatCurrency(r.plan, cur)}</span>}</td>
                    <td className="px-4 py-2 text-right tnum">{formatCurrency(r.actual, cur)}</td>
                    <td className={`px-4 py-2 text-right tnum ${r.favorable ? 'text-emerald-600' : 'text-rose-600'}`}>{r.variance >= 0 ? '+' : ''}{formatCurrency(r.variance, cur)}</td>
                    <td className="px-4 py-2 text-right"><div className="ml-auto flex w-28 items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${r.favorable ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, r.pct)}%` }} /></div>
                      <span className="w-9 text-right text-xs text-muted-foreground">{r.pct}%</span>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></CardContent></Card>
        </TabsContent>

        {/* ── Aylıq ── */}
        <TabsContent value="monthly" className="mt-4 space-y-4">
          <Card className="rounded-card"><CardContent className="p-5">
            <p className="mb-3 text-sm font-medium text-muted-foreground">{tt('Aylıq plan vs fakt xalis mənfəət', 'Monthly planned vs actual net profit')}</p>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={monthlyChart}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={54} tickFormatter={(v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip formatter={(v: number) => formatCurrency(v, cur)} />
                <Legend />
                <Bar name={tt('Plan', 'Plan')} dataKey="plan" fill="#5B5BF5" radius={[4, 4, 0, 0]} barSize={16} />
                <Line name={tt('Fakt', 'Actual')} type="monotone" dataKey="actual" stroke="#16c098" strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
            {view === 'monthly' && !monthlyActual && <p className="mt-2 text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> {tt('Aylıq fakt hesablanır…', 'Computing monthly actuals…')}</p>}
          </CardContent></Card>

          <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border bg-secondary/40 font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="sticky left-0 bg-secondary/40 px-3 py-2 text-left">{tt('Kateqoriya', 'Category')}</th>
                {MONTHS.map((m) => <th key={m} className="px-2 py-2 text-right">{m}</th>)}
                <th className="px-3 py-2 text-right">{tt('Cəmi', 'Total')}</th>
              </tr></thead>
              <tbody>
                {BUDGET_CATEGORIES.map((c) => {
                  const arr = monthlyPlan[c.key] ?? Array(12).fill(0);
                  const total = round2(arr.reduce((s, v) => s + (v || 0), 0));
                  return (
                    <tr key={c.key} className="border-b border-border/50 last:border-0">
                      <td className="sticky left-0 bg-card px-3 py-1.5 font-medium">
                        <span className="flex items-center gap-1">{tt(c.az, c.en)}
                          {canEdit && <button onClick={() => splitFromAnnual(c.key)} title={tt('İllikdən bərabər böl', 'Even split from annual')} className="text-muted-foreground hover:text-primary"><SplitSquareHorizontal className="h-3.5 w-3.5" /></button>}</span>
                      </td>
                      {arr.map((v, i) => (
                        <td key={i} className="px-1 py-1 text-right">{canEdit
                          ? <Input className="h-7 w-16 px-1 text-right tnum text-xs" type="number" value={v || ''} onChange={(e) => setMonth(c.key, i, Number(e.target.value))} />
                          : <span className="tnum">{v || 0}</span>}</td>
                      ))}
                      <td className="px-3 py-1.5 text-right font-semibold tnum">{formatCurrency(total, cur)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div></CardContent></Card>
          <p className="text-xs text-muted-foreground">{tt('Hər kateqoriyanı aylara bölün (və ya illik plandan bərabər bölmə düyməsindən istifadə edin). Fakt xalis mənfəət aylıq IFRS hesablamasından gəlir.', 'Distribute each category across months (or use the even-split button from the annual plan). Actual net profit comes from the monthly IFRS computation.')}</p>
        </TabsContent>

        {/* ── Departament üzrə ── */}
        <TabsContent value="department" className="mt-4">
          {(departments ?? []).length === 0 ? (
            <EmptyState title={tt('Şöbə yoxdur', 'No departments')} description={tt('Şirkət → Şöbələr bölməsindən əlavə edin', 'Add via Company → Departments')} />
          ) : (
            <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border bg-secondary/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left">{tt('Departament', 'Department')}</th><th className="px-4 py-2.5 text-right">{tt('Plan (mənfəət)', 'Plan (profit)')}</th>
                  <th className="px-4 py-2.5 text-right">{tt('Fakt (mənfəət)', 'Actual (profit)')}</th><th className="px-4 py-2.5 text-right">{tt('Fərq', 'Variance')}</th>
                </tr></thead>
                <tbody>
                  {(departments ?? []).map((d) => {
                    const p = Number(departmentPlan[d.id]?.__profit) || 0;
                    const a = deptActual?.[d.id];
                    const variance = a != null ? round2(a - p) : null;
                    return (
                      <tr key={d.id} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-2 font-medium">{tt(d.name.az, d.name.en)} <span className="text-xs text-muted-foreground">({d.code})</span></td>
                        <td className="px-4 py-2 text-right">{canEdit
                          ? <Input className="ml-auto h-8 w-32 text-right tnum" type="number" value={departmentPlan[d.id]?.__profit ?? ''} onChange={(e) => setDeptPlan(d.id, Number(e.target.value))} />
                          : <span className="tnum">{formatCurrency(p, cur)}</span>}</td>
                        <td className="px-4 py-2 text-right tnum">{a != null ? formatCurrency(a, cur) : <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />}</td>
                        <td className={`px-4 py-2 text-right tnum ${variance == null ? '' : variance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{variance == null ? '—' : `${variance >= 0 ? '+' : ''}${formatCurrency(variance, cur)}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div></CardContent></Card>
          )}
          <p className="mt-3 text-xs text-muted-foreground">{tt('Fakt mənfəət hər departamentin (dimension) IFRS Mənfəət-Zərərindən hesablanır. Departament planı ümumi mənfəət hədəfidir.', 'Actual profit is computed from each department (dimension) IFRS P&L. The department plan is a total-profit target.')}</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
