'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Download } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listFixedAssets, monthlyDepreciation } from '@/lib/firebase/accounting';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { exportToExcel } from '@/lib/utils/export';
import { formatCurrency } from '@/lib/utils/format';
import type { FixedAsset } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;
const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'];

/** Aktivin növbəti n ay üzrə xalis qalıq dəyəri (NBV) proqnozu */
function projectNbv(a: FixedAsset, months: number): number[] {
  let nbv = a.netBookValue;
  const out: number[] = [];
  for (let i = 0; i < months; i++) {
    let dep = 0;
    if (a.status === 'active') {
      dep = a.depreciationMethod === 'straight_line'
        ? round2(Math.max(0, (a.acquisitionCost - a.residualValue) / a.usefulLifeMonths))
        : round2(nbv * ((a.reducingBalanceRate ?? 0) / 100) / 12);
      dep = Math.min(dep, Math.max(0, nbv - a.residualValue));
    }
    nbv = round2(nbv - dep);
    out.push(nbv);
  }
  return out;
}

export default function DepreciationPage() {
  const tt = useTT();
  const { active, isSuperAdmin, can } = useAuth();
  const companyId = active?.companyId;
  const cur = active?.company.baseCurrency ?? 'AZN';
  const canView = isSuperAdmin || can('accounting.coa.view') || can('reports.view');

  const { data: assets } = useQuery({ queryKey: ['fixedAssets', companyId], queryFn: () => listFixedAssets(companyId!), enabled: canView && !!companyId });

  const rows = useMemo(() => (assets ?? []).map((a) => {
    const monthly = monthlyDepreciation(a);
    const depreciable = a.acquisitionCost - a.residualValue;
    const pct = depreciable > 0 ? Math.min(100, Math.round((a.accumulatedDepreciation / depreciable) * 100)) : 100;
    const remaining = monthly > 0 ? Math.ceil((a.netBookValue - a.residualValue) / monthly) : 0;
    return { a, monthly: round2(monthly), pct, remaining };
  }), [assets]);

  const totals = useMemo(() => ({
    cost: round2(rows.reduce((s, r) => s + r.a.acquisitionCost, 0)),
    accum: round2(rows.reduce((s, r) => s + r.a.accumulatedDepreciation, 0)),
    nbv: round2(rows.reduce((s, r) => s + r.a.netBookValue, 0)),
    monthly: round2(rows.reduce((s, r) => s + r.monthly, 0)),
  }), [rows]);

  const projection = useMemo(() => {
    const now = new Date();
    const series = (assets ?? []).map((a) => projectNbv(a, 12));
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return { label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, nbv: round2(series.reduce((s, arr) => s + (arr[i] ?? 0), 0)) };
    });
  }, [assets]);

  if (!companyId) return <div><PageHeader title={tt('Amortizasiya cədvəli', 'Depreciation schedule')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('Amortizasiya cədvəli', 'Depreciation schedule')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader
        title={tt('Amortizasiya cədvəli', 'Depreciation schedule')}
        subtitle={tt('Əsas vəsaitlərin köhnəlməsi və xalis qalıq dəyəri proqnozu', 'Fixed-asset depreciation and net book value projection')}
        action={<Button variant="outline" onClick={() => exportToExcel('amortizasiya-cedveli', [
          { header: tt('Aktiv', 'Asset'), value: (r: typeof rows[number]) => r.a.assetName }, { header: tt('Metod', 'Method'), value: (r: typeof rows[number]) => r.a.depreciationMethod },
          { header: tt('Dəyər', 'Cost'), value: (r: typeof rows[number]) => r.a.acquisitionCost }, { header: tt('Aylıq', 'Monthly'), value: 'monthly' },
          { header: tt('Yığılmış', 'Accumulated'), value: (r: typeof rows[number]) => r.a.accumulatedDepreciation }, { header: 'NBV', value: (r: typeof rows[number]) => r.a.netBookValue },
        ], rows)}><Download className="h-4 w-4" /> Excel</Button>}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Mini label={tt('Ümumi dəyər', 'Total cost')} value={formatCurrency(totals.cost, cur)} />
        <Mini label={tt('Yığılmış köhnəlmə', 'Accumulated')} value={formatCurrency(totals.accum, cur)} />
        <Mini label={tt('Xalis qalıq (NBV)', 'Net book value')} value={formatCurrency(totals.nbv, cur)} primary />
        <Mini label={tt('Aylıq köhnəlmə', 'Monthly depreciation')} value={formatCurrency(totals.monthly, cur)} />
      </div>

      {rows.length === 0 ? <EmptyState title={tt('Əsas vəsait yoxdur', 'No fixed assets')} description={tt('Mühasibat → Əsas vəsaitlər bölməsində əlavə edin', 'Add them under Accounting → Fixed assets')} /> : (
        <>
          <Card className="mb-4 rounded-card"><CardContent className="p-5">
            <p className="mb-3 text-sm font-medium text-muted-foreground">{tt('Xalis qalıq dəyəri proqnozu (12 ay)', 'Net book value projection (12 months)')}</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={projection}>
                <defs><linearGradient id="nbvGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5B5BF5" stopOpacity={0.4} /><stop offset="100%" stopColor="#5B5BF5" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis fontSize={11} tickLine={false} axisLine={false} width={54} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip formatter={(v: number) => formatCurrency(v, cur)} />
                <Area type="monotone" dataKey="nbv" stroke="#5B5BF5" strokeWidth={2.5} fill="url(#nbvGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent></Card>

          <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-secondary/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 text-left">{tt('Aktiv', 'Asset')}</th>
                <th className="px-4 py-2.5 text-left">{tt('Metod', 'Method')}</th>
                <th className="px-4 py-2.5 text-right">{tt('Dəyər', 'Cost')}</th>
                <th className="px-4 py-2.5 text-right">{tt('Aylıq', 'Monthly')}</th>
                <th className="px-4 py-2.5 text-right">{tt('Yığılmış', 'Accumulated')}</th>
                <th className="px-4 py-2.5 text-right">NBV</th>
                <th className="px-4 py-2.5 text-right">{tt('Qalan ay', 'Months left')}</th>
                <th className="px-4 py-2.5 text-left">{tt('İcra', 'Progress')}</th>
              </tr></thead>
              <tbody>
                {rows.map(({ a, monthly, pct, remaining }) => (
                  <tr key={a.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2 font-medium">{a.assetName}</td>
                    <td className="px-4 py-2 text-muted-foreground">{a.depreciationMethod === 'straight_line' ? tt('Düz xətli', 'Straight-line') : tt('Azalan qalıq', 'Reducing')}</td>
                    <td className="px-4 py-2 text-right tnum">{formatCurrency(a.acquisitionCost, cur)}</td>
                    <td className="px-4 py-2 text-right tnum">{formatCurrency(monthly, cur)}</td>
                    <td className="px-4 py-2 text-right tnum text-muted-foreground">{formatCurrency(a.accumulatedDepreciation, cur)}</td>
                    <td className="px-4 py-2 text-right tnum font-semibold">{formatCurrency(a.netBookValue, cur)}</td>
                    <td className="px-4 py-2 text-right tnum">{a.status === 'active' ? remaining : '—'}</td>
                    <td className="px-4 py-2">
                      <div className="flex w-32 items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                        <span className="w-8 text-right text-xs text-muted-foreground">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></CardContent></Card>
        </>
      )}
    </div>
  );
}

function Mini({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <Card className="rounded-card"><CardContent className="p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${primary ? 'text-primary' : ''}`}>{value}</p>
    </CardContent></Card>
  );
}
