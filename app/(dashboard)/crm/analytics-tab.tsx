'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Users, Target, Trophy, Coins } from 'lucide-react';
import { listLeads, listOpportunities } from '@/lib/firebase/crm';
import { funnel, winRate, STAGE_MAP } from '@/lib/crm/pipeline';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency } from '@/lib/utils/format';
import { LEAD_SOURCE } from './leads-tab';
import type { LeadSource } from '@/types';
import type { CrmTabProps } from './page';

export function AnalyticsTab({ companyId, baseCurrency }: CrmTabProps) {
  const tt = useTT();
  const { data: leads, isLoading: ll } = useQuery({ queryKey: ['crmLeads', companyId], queryFn: () => listLeads(companyId) });
  const { data: opps, isLoading: lo } = useQuery({ queryKey: ['crmOpportunities', companyId], queryFn: () => listOpportunities(companyId) });

  const stats = useMemo(() => {
    const L = leads ?? []; const O = opps ?? [];
    const converted = L.filter((l) => l.convertedToOpportunityId || l.convertedToCustomerId).length;
    const wonValue = O.filter((o) => o.stage === 'won').reduce((s, o) => s + (o.amount || 0), 0);
    const wonCount = O.filter((o) => o.stage === 'won').length;
    return {
      totalLeads: L.length,
      convRate: L.length ? Math.round((converted / L.length) * 100) : 0,
      wr: winRate(O),
      wonValue,
      avgDeal: wonCount ? wonValue / wonCount : 0,
    };
  }, [leads, opps]);

  const fn = useMemo(() => funnel(opps ?? []), [opps]);
  const maxFn = Math.max(1, ...fn.map((f) => f.count));

  const sources = useMemo(() => {
    const m = new Map<string, number>();
    (leads ?? []).forEach((l) => m.set(l.source, (m.get(l.source) ?? 0) + 1));
    const total = (leads ?? []).length || 1;
    return Array.from(m, ([source, count]) => ({ source: source as LeadSource, count, pct: Math.round((count / total) * 100) })).sort((a, b) => b.count - a.count);
  }, [leads]);

  if (ll || lo) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if ((leads ?? []).length === 0 && (opps ?? []).length === 0) return <EmptyState title={tt('Məlumat yoxdur', 'No data')} description={tt('Lead və imkanlar əlavə olunduqca analitika görünəcək.', 'Analytics appear as leads and opportunities are added.')} />;

  const tiles = [
    { icon: Users, tint: 'text-sky-500', label: tt('Ümumi lead', 'Total leads'), val: String(stats.totalLeads) },
    { icon: Target, tint: 'text-violet-500', label: tt('Çevrilmə nisbəti', 'Conversion rate'), val: `${stats.convRate}%` },
    { icon: Trophy, tint: 'text-emerald-500', label: tt('Uğur nisbəti', 'Win rate'), val: `${stats.wr}%` },
    { icon: Coins, tint: 'text-amber-500', label: tt('Orta sövdələşmə', 'Avg deal size'), val: formatCurrency(stats.avgDeal, baseCurrency) },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <Card key={i} className="rounded-card"><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><t.icon className={cn('h-4 w-4', t.tint)} /> {t.label}</div>
            <p className="mt-1.5 text-xl font-bold tnum">{t.val}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-card"><CardContent className="p-5">
          <p className="mb-4 text-sm font-semibold">{tt('Satış huni (funnel)', 'Sales funnel')}</p>
          <div className="space-y-2.5">
            {fn.map((f) => (
              <div key={f.stage.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className={cn('font-medium', f.stage.tint)}>{tt(f.stage.az, f.stage.en)}</span>
                  <span className="text-muted-foreground tnum">{f.count} · {formatCurrency(f.value, baseCurrency)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div className={cn('h-full rounded-full', f.stage.bar)} style={{ width: `${Math.max(3, (f.count / maxFn) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>

        <Card className="rounded-card"><CardContent className="p-5">
          <p className="mb-4 text-sm font-semibold">{tt('Lead mənbələri', 'Lead sources')}</p>
          {sources.length === 0 ? <p className="text-sm text-muted-foreground">{tt('Lead yoxdur', 'No leads')}</p> : (
            <div className="space-y-2.5">
              {sources.map((s) => (
                <div key={s.source}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{tt(LEAD_SOURCE[s.source]?.az ?? s.source, LEAD_SOURCE[s.source]?.en ?? s.source)}</span>
                    <span className="text-muted-foreground tnum">{s.count} · {s.pct}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#5B5BF5] to-[#8b3df0]" style={{ width: `${Math.max(3, s.pct)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">{tt('Qazanılmış ümumi dəyər:', 'Total won value:')} <span className="font-semibold text-foreground">{formatCurrency(stats.wonValue, baseCurrency)}</span></p>
        </CardContent></Card>
      </div>

      <p className="text-xs text-muted-foreground">{tt('Qeyd: dəyər hesablamalarında imkanların öz valyutası baza valyutaya çevrilmədən götürülür (sadələşdirilmiş göstərici).', 'Note: value figures use each opportunity\'s own currency without conversion (simplified indicator).')}</p>
    </div>
  );
}
