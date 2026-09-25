'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listInvoices } from '@/lib/firebase/sales';
import { listPurchaseBills } from '@/lib/firebase/treasury';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency } from '@/lib/utils/format';

const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'];
const round2 = (n: number) => Math.round(n * 100) / 100;

export default function CashflowPage() {
  const tt = useTT();
  const { active, isSuperAdmin, can } = useAuth();
  const companyId = active?.companyId;
  const cur = active?.company.baseCurrency ?? 'AZN';
  const canView = isSuperAdmin || can('cashbank.transaction.view') || can('reports.view');
  const [opening, setOpening] = useState('0');

  const { data: invoices } = useQuery({ queryKey: ['invoices', companyId], queryFn: () => listInvoices(companyId!), enabled: canView && !!companyId });
  const { data: bills } = useQuery({ queryKey: ['purchaseBills', companyId], queryFn: () => listPurchaseBills(companyId!), enabled: canView && !!companyId });

  const buckets = useMemo(() => {
    const now = new Date();
    // Cari ay + növbəti 5 ay üçün seqmentlər (keçmiş/gecikmiş → ilk aya yığılır)
    const segs = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, y: d.getFullYear(), m: d.getMonth(), inflow: 0, outflow: 0 };
    });
    const firstKey = segs[0].key;
    const idx = (dateStr: string): number => {
      if (!dateStr) return 0;
      const d = new Date(dateStr);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const found = segs.findIndex((s) => s.key === k);
      if (found >= 0) return found;
      // keçmiş → 0-cı aya (gecikmiş), gələcək (6 aydan sonra) → sonuncuya
      return d < now ? 0 : segs.length - 1;
    };
    void firstKey;
    for (const inv of invoices ?? []) {
      if (!['sent', 'partially_paid', 'overdue'].includes(inv.status)) continue;
      const due = inv.amountDue ?? 0;
      if (due > 0) segs[idx(inv.dueDate)].inflow += due;
    }
    for (const b of bills ?? []) {
      if (!['approved', 'partially_paid', 'overdue'].includes(b.status)) continue;
      const due = b.amountDue ?? 0;
      if (due > 0) segs[idx(b.dueDate)].outflow += due;
    }
    let running = Number(opening) || 0;
    return segs.map((s) => {
      const net = round2(s.inflow - s.outflow);
      running = round2(running + net);
      return { label: s.label, inflow: round2(s.inflow), outflow: round2(s.outflow), net, balance: running };
    });
  }, [invoices, bills, opening]);

  const totals = useMemo(() => ({
    inflow: round2(buckets.reduce((s, b) => s + b.inflow, 0)),
    outflow: round2(buckets.reduce((s, b) => s + b.outflow, 0)),
    end: buckets.length ? buckets[buckets.length - 1].balance : 0,
  }), [buckets]);

  if (!companyId) return <div><PageHeader title={tt('Pul vəsaiti proqnozu', 'Cash flow forecast')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('Pul vəsaiti proqnozu', 'Cash flow forecast')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader
        title={tt('Pul vəsaiti proqnozu', 'Cash flow forecast')}
        subtitle={tt('Gözlənilən daxilolmalar (AR) və ödənişlər (AP) — 6 ay', 'Expected inflows (AR) and outflows (AP) — 6 months')}
        action={
          <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">{tt('Açılış qalığı', 'Opening cash')}</Label>
            <Input type="number" className="h-9 w-36 text-right" value={opening} onChange={(e) => setOpening(e.target.value)} /></div>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat icon={TrendingUp} tint="text-emerald-600 bg-emerald-500/12" label={tt('Gözlənilən daxilolma', 'Expected inflow')} value={formatCurrency(totals.inflow, cur)} />
        <Stat icon={TrendingDown} tint="text-rose-600 bg-rose-500/12" label={tt('Gözlənilən ödəniş', 'Expected outflow')} value={formatCurrency(totals.outflow, cur)} />
        <Stat icon={Wallet} tint="text-primary bg-primary/12" label={tt('Dövr sonu qalıq (proqnoz)', 'Projected end balance')} value={formatCurrency(totals.end, cur)} />
      </div>

      <Card className="mb-4 rounded-card"><CardContent className="p-5">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={buckets}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis fontSize={11} tickLine={false} axisLine={false} width={54} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
            <Tooltip formatter={(v: number) => formatCurrency(v, cur)} />
            <Legend />
            <Bar name={tt('Daxilolma', 'Inflow')} dataKey="inflow" fill="#16c098" radius={[4, 4, 0, 0]} barSize={18} />
            <Bar name={tt('Ödəniş', 'Outflow')} dataKey="outflow" fill="#ff6a6a" radius={[4, 4, 0, 0]} barSize={18} />
            <Line name={tt('Proqnoz qalıq', 'Projected balance')} type="monotone" dataKey="balance" stroke="#5B5BF5" strokeWidth={2.5} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent></Card>

      <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border bg-secondary/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 text-left">{tt('Ay', 'Month')}</th>
            <th className="px-4 py-2.5 text-right">{tt('Daxilolma', 'Inflow')}</th>
            <th className="px-4 py-2.5 text-right">{tt('Ödəniş', 'Outflow')}</th>
            <th className="px-4 py-2.5 text-right">{tt('Xalis', 'Net')}</th>
            <th className="px-4 py-2.5 text-right">{tt('Qalıq (proqnoz)', 'Balance')}</th>
          </tr></thead>
          <tbody>
            {buckets.map((b, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0">
                <td className="px-4 py-2 font-medium">{b.label}</td>
                <td className="px-4 py-2 text-right tnum text-emerald-600">{formatCurrency(b.inflow, cur)}</td>
                <td className="px-4 py-2 text-right tnum text-rose-600">{formatCurrency(b.outflow, cur)}</td>
                <td className={`px-4 py-2 text-right tnum ${b.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{b.net >= 0 ? '+' : ''}{formatCurrency(b.net, cur)}</td>
                <td className={`px-4 py-2 text-right tnum font-semibold ${b.balance < 0 ? 'text-rose-600' : ''}`}>{formatCurrency(b.balance, cur)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></CardContent></Card>
      <p className="mt-3 text-xs text-muted-foreground">{tt('Proqnoz ödənilməmiş fakturaların və alışların son ödəniş tarixlərinə əsaslanır. Gecikmiş məbləğlər cari aya daxil edilir.', 'The forecast is based on the due dates of unpaid invoices and bills. Overdue amounts are folded into the current month.')}</p>
    </div>
  );
}

function Stat({ icon: Icon, tint, label, value }: { icon: typeof Wallet; tint: string; label: string; value: string }) {
  return (
    <Card className="rounded-card"><CardContent className="flex items-center gap-3 p-5">
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}><Icon className="h-5 w-5" /></span>
      <div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-0.5 text-xl font-bold">{value}</p></div>
    </CardContent></Card>
  );
}
