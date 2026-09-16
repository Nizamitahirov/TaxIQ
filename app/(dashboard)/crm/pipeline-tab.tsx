'use client';

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, ChevronLeft, ChevronRight, Trophy, XCircle, TrendingUp, Wallet, Target, Percent } from 'lucide-react';
import { listOpportunities, setOpportunityStage } from '@/lib/firebase/crm';
import { STAGES, OPEN_STAGES, STAGE_MAP, weightedForecast, openPipelineValue, winRate } from '@/lib/crm/pipeline';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency } from '@/lib/utils/format';
import type { Opportunity, OpportunityStage } from '@/types';
import type { CrmTabProps } from './page';

const initials = (n?: string | null) => (n ?? '?').split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();

export function PipelineTab({ companyId, actorUid, actorName, baseCurrency }: CrmTabProps) {
  const qc = useQueryClient();
  const tt = useTT();
  const { data, isLoading } = useQuery({ queryKey: ['crmOpportunities', companyId], queryFn: () => listOpportunities(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['crmOpportunities', companyId] });

  const opps = useMemo(() => data ?? [], [data]);
  const forecast = useMemo(() => weightedForecast(opps), [opps]);
  const openVal = useMemo(() => openPipelineValue(opps), [opps]);
  const wr = useMemo(() => winRate(opps), [opps]);
  const openCount = opps.filter((o) => STAGE_MAP[o.stage]?.open).length;

  async function move(o: Opportunity, dir: -1 | 1) {
    const openKeys = OPEN_STAGES.map((s) => s.key);
    const idx = openKeys.indexOf(o.stage as OpportunityStage);
    const next = openKeys[idx + dir];
    if (!next) return;
    try { await setOpportunityStage(o, next, actorUid, actorName ?? undefined); refresh(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
  }
  async function close(o: Opportunity, stage: 'won' | 'lost') {
    try { await setOpportunityStage(o, stage, actorUid, actorName ?? undefined); toast.success(stage === 'won' ? tt('Uğurlu bağlandı 🎉', 'Marked won 🎉') : tt('İtirilmiş kimi işarələndi', 'Marked lost')); refresh(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const tiles = [
    { icon: Wallet, label: tt('Açıq pipeline dəyəri', 'Open pipeline value'), val: formatCurrency(openVal, baseCurrency), tint: 'text-sky-500' },
    { icon: TrendingUp, label: tt('Çəkili proqnoz', 'Weighted forecast'), val: formatCurrency(forecast, baseCurrency), tint: 'text-violet-500' },
    { icon: Percent, label: tt('Uğur nisbəti', 'Win rate'), val: `${wr}%`, tint: 'text-emerald-500' },
    { icon: Target, label: tt('Açıq imkanlar', 'Open opportunities'), val: String(openCount), tint: 'text-amber-500' },
  ];

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <Card key={i} className="rounded-card"><CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><t.icon className={cn('h-4 w-4', t.tint)} /> {t.label}</div>
            <p className="mt-1.5 text-xl font-bold tnum">{t.val}</p>
          </CardContent></Card>
        ))}
      </div>

      {opps.length === 0 ? (
        <EmptyState title={tt('Pipeline boşdur', 'Pipeline is empty')} description={tt('«İmkanlar» bölməsindən və ya lead-i çevirərək imkan yaradın.', 'Create an opportunity from the Opportunities tab or by converting a lead.')} />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {OPEN_STAGES.map((stage) => {
            const rows = opps.filter((o) => o.stage === stage.key);
            const sum = rows.reduce((s, o) => s + (o.amount || 0), 0);
            return (
              <div key={stage.key} className="flex w-72 shrink-0 flex-col">
                <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                  <span className={cn('flex items-center gap-1.5 text-sm font-semibold', stage.tint)}>
                    <span className={cn('h-2 w-2 rounded-full', stage.bar)} /> {tt(stage.az, stage.en)}
                  </span>
                  <span className="text-xs text-muted-foreground">{rows.length} · {formatCurrency(sum, baseCurrency)}</span>
                </div>
                <div className="flex flex-col gap-2">
                  {rows.map((o) => {
                    const idx = OPEN_STAGES.findIndex((s) => s.key === o.stage);
                    return (
                      <div key={o.id} className="rounded-card border border-border bg-card p-3 shadow-soft transition-shadow hover:shadow-soft-lg">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold leading-snug">{o.title}</p>
                          <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">{o.probability}%</Badge>
                        </div>
                        {o.customerName && <p className="mt-0.5 text-xs text-muted-foreground">{o.customerName}</p>}
                        <p className="mt-1.5 font-bold tnum">{formatCurrency(o.amount, o.currency)}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            {o.ownerName && <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">{initials(o.ownerName)}</span>}
                            {o.opportunityNumber}
                          </span>
                          <div className="flex items-center gap-0.5">
                            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx <= 0} title={tt('Geri', 'Back')} onClick={() => move(o, -1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6" disabled={idx >= OPEN_STAGES.length - 1} title={tt('İrəli', 'Forward')} onClick={() => move(o, 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-500" title={tt('Qazanıldı', 'Won')} onClick={() => close(o, 'won')}><Trophy className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-500" title={tt('İtirildi', 'Lost')} onClick={() => close(o, 'lost')}><XCircle className="h-3.5 w-3.5" /></Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {rows.length === 0 && <p className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">{tt('boş', 'empty')}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
