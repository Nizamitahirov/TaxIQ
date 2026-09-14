'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  ResponsiveContainer, ComposedChart, Bar, Line, BarChart, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, PolarAngleAxis,
} from 'recharts';
import {
  Building2, Users2, Wallet, FileWarning, TrendingUp, ArrowUpRight, ArrowRight,
  ShieldCheck, Receipt, UserCheck, Inbox, AlertTriangle, Target, Sparkles, Camera, Loader2,
  SlidersHorizontal, ArrowUp, ArrowDown, Eye, EyeOff, RotateCcw,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useAvatarUpload } from '@/components/shared/use-avatar-upload';
import {
  DASH_CHART_WIDGETS, DASH_SECTIONS, loadDashConfig, saveDashConfig, isHidden, orderedCharts, type DashConfig,
} from '@/lib/dashboard/customize';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { loadPlatformMetrics } from '@/lib/dashboard/kpi';
import { loadLiveCompanyKpis, type LiveCompanyKpis } from '@/lib/dashboard/live';
import { ChartCard } from '@/components/charts/chart-card';
import { CHART_COLORS, PRIMARY } from '@/components/charts/palette';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const { profile, isSuperAdmin, active, can } = useAuth();
  const now = new Date();
  const greet = now.getHours() < 12 ? t('greetingMorning') : now.getHours() < 18 ? t('greetingAfternoon') : t('greetingEvening');
  const firstName = (profile?.displayName ?? 'İstifadəçi').split(' ')[0];
  const todayStr = now.toLocaleDateString('az-AZ', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div>
      {isSuperAdmin && <PlatformSection greet={greet} firstName={firstName} todayStr={todayStr} avatarUrl={profile?.avatarUrl ?? undefined} />}
      {active && <CompanySection companyId={active.companyId} company={active.company} roleName={active.roleName}
        greet={greet} firstName={firstName} todayStr={todayStr} avatarUrl={profile?.avatarUrl ?? undefined}
        canViewSalary={can('hr.employee.salary.view')} showHero={!isSuperAdmin} uid={profile?.uid ?? ''} />}
      {!isSuperAdmin && !active && (
        <Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Hələ heç bir şirkətə təyin olunmamısınız.</CardContent></Card>
      )}
    </div>
  );
}

// ═══════════ PLATFORM ═══════════
function PlatformSection({ greet, firstName, todayStr, avatarUrl }: { greet: string; firstName: string; todayStr: string; avatarUrl?: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['platform-metrics'], queryFn: loadPlatformMetrics });
  return (
    <div className="flex flex-col gap-6">
      <Hero title={`${greet}, ${firstName} 👋`} sub={`${todayStr} · Platform İdarə Paneli`} label="TaxIQ · Super Admin" cta={{ href: '/companies/new', label: 'Yeni müştəri' }} avatar={{ name: firstName, avatarUrl, editable: true }} />
      {isLoading || !data ? <KpiSkeleton /> : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard icon={Building2} tint="bg-violet-500/12 text-violet-600" label="Şirkətlər" value={String(data.totalCompanies)} sub={`${data.activeCompanies} aktiv`} />
            <KpiCard icon={ShieldCheck} tint="bg-emerald-500/12 text-emerald-600" label="Aktiv" value={String(data.activeCompanies)} sub={`${data.suspendedCompanies} dayandırılıb`} />
            <KpiCard icon={Users2} tint="bg-sky-500/12 text-sky-600" label="İstifadəçilər" value={String(data.totalUsers)} sub={`${data.staffUsers} staff`} />
            <KpiCard icon={UserCheck} tint="bg-amber-500/12 text-amber-600" label="Müştəri istifadəçiləri" value={String(data.clientUsers)} />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartCard title="Sektor üzrə bölgü" className="lg:col-span-1">
              {data.sectorDistribution.length === 0 ? <Empty text="Şirkət yoxdur" /> : (
                <ResponsiveContainer width="100%" height={220}><PieChart><Pie data={data.sectorDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>{data.sectorDistribution.map((_, i) => <Cell key={i} stroke="transparent" fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
              )}
            </ChartCard>
            <Card className="rounded-card lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Şirkətlər</CardTitle><Link href="/companies" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Hamısı <ArrowUpRight className="h-3.5 w-3.5" /></Link></CardHeader>
              <CardContent className="p-0"><div className="divide-y divide-border/50">
                {data.companies.slice(0, 7).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{c.name.slice(0, 2).toUpperCase()}</span>
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{c.name} {c.isInternal && <span className="text-xs text-primary">· Daxili</span>}</p><p className="truncate text-xs text-muted-foreground">{c.taxId ? `VÖEN ${c.taxId}` : c.sector}</p></div>
                    <Badge variant={c.status === 'active' ? 'success' : c.status === 'suspended' ? 'warning' : 'secondary'}>{c.status}</Badge>
                  </div>
                ))}
              </div></CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════ COMPANY — Uperp tərzi zəngin panel ═══════════
function CompanySection({ companyId, company, roleName, greet, firstName, todayStr, avatarUrl, canViewSalary, showHero, uid }: {
  companyId: string; company: { name: string; baseCurrency: string }; roleName: string; greet: string; firstName: string; todayStr: string; avatarUrl?: string; canViewSalary: boolean; showHero: boolean; uid: string;
}) {
  const { data: m, isLoading } = useQuery({ queryKey: ['live-kpis', companyId], queryFn: () => loadLiveCompanyKpis(companyId) });
  const cur = company.baseCurrency;
  const [cfg, setCfg] = useState<DashConfig>({ order: DASH_CHART_WIDGETS.map((w) => w.key), hidden: [] });
  const [custOpen, setCustOpen] = useState(false);
  useEffect(() => { setCfg(loadDashConfig(uid, companyId)); }, [uid, companyId]);
  if (isLoading || !m) return <div className="mt-6"><KpiSkeleton /></div>;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* LEFT */}
        <div className="flex min-w-0 flex-col gap-6">
          {showHero && <Hero title={`${greet}, ${firstName} 🔥`} sub={`${todayStr} · ${company.name}`} label={`TaxIQ · ${roleName}`} cta={{ href: '/sales', label: 'Yeni faktura' }} />}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatMini icon={TrendingUp} tint="bg-violet-500/12 text-violet-600" value={formatCurrency(m.revenueThisMonth, cur)} label="Bu ay gəlir" />
            <StatMini icon={Wallet} tint="bg-emerald-500/12 text-emerald-600" value={formatCurrency(m.cashTotal, cur)} label="Kassa/Bank" />
            <StatMini icon={Receipt} tint="bg-sky-500/12 text-sky-600" value={formatCurrency(m.arTotal, cur)} label="Debitor (AR)" />
          </div>

          {/* Top müştərilər carousel */}
          <div className="flex flex-1 flex-col">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold tracking-tight">Top müştərilər</h2>
              <Link href="/sales" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">Hamısı <ArrowUpRight className="h-4 w-4" /></Link>
            </div>
            {m.topCustomers.length === 0 ? <Card className="rounded-card flex-1"><Empty text="Hələ satış datası yoxdur" /></Card> : (
              <div className="flex flex-1 items-stretch gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {m.topCustomers.map((c, i) => <CustomerCard key={c.name} name={c.name} revenue={c.revenue} cur={cur} max={m.topCustomers[0].revenue} idx={i} />)}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT aside */}
        <aside className="flex flex-col gap-5">
          <Card className="rounded-card">
            <CardHeader className="pb-0"><CardTitle className="flex items-center gap-2 text-base"><Target className="h-4 w-4 text-primary" /> Aylıq gəlir hədəfi</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center pt-4 text-center">
              <AvatarRing name={firstName} avatarUrl={avatarUrl} percent={Math.round(m.targetPct)} editable />
              {m.monthlyTarget > 0 ? (<>
                <p className="mt-4 text-lg font-bold">{formatCurrency(m.revenueThisMonth, cur)}</p>
                <p className="text-xs text-muted-foreground">/ {formatCurrency(m.monthlyTarget, cur)} hədəf (5 ay ortası) · bu ay</p>
              </>) : (<>
                <p className="mt-4 text-sm font-medium">Tarixçə toplanır</p>
                <p className="text-xs text-muted-foreground">Fakturalar artdıqca hədəf hesablanacaq</p>
              </>)}
            </CardContent>
          </Card>

          <Card className="rounded-card">
            <CardHeader className="pb-0"><CardTitle className="text-base">Aylıq gəlir</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={m.revenueTrend} barSize={22}>
                  <defs><linearGradient id="miniBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c6cf5" /><stop offset="100%" stopColor="#5B5BF5" /></linearGradient></defs>
                  <XAxis dataKey="month" fontSize={11} tickLine={false} axisLine={false} /><YAxis fontSize={11} tickLine={false} axisLine={false} width={30} />
                  <Tooltip formatter={(v: number) => formatCurrency(v, cur)} cursor={{ fill: 'rgba(91,91,245,0.06)' }} />
                  <Bar dataKey="value" radius={[8, 8, 4, 4]}>{m.revenueTrend.map((d, i) => { const max = Math.max(...m.revenueTrend.map((x) => x.value)); return <Cell key={i} fill={d.value === max ? '#5B5BF5' : 'url(#miniBar)'} fillOpacity={d.value === max ? 1 : 0.5} />; })}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="rounded-card flex flex-1 flex-col">
            <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Top müştərilər</CardTitle><Link href="/sales" className="text-xs font-medium text-primary hover:underline">Hamısı</Link></CardHeader>
            <CardContent className="space-y-1">
              {m.topCustomers.length === 0 ? <Empty text="Müştəri satışı yoxdur" /> : m.topCustomers.slice(0, 5).map((c) => (
                <div key={c.name} className="flex items-center gap-3 border-b border-border/50 py-2 last:border-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#5B5BF5] to-[#8b3df0] text-xs font-bold text-white">{c.name.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{c.name}</p><p className="text-xs text-muted-foreground">Müştəri</p></div>
                  <span className="shrink-0 text-sm font-bold text-primary">{formatCurrency(c.revenue, cur)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Alertlər */}
      {!isHidden(cfg, 'alerts') && (m.overdueCount > 0 || m.pendingApprovals > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {m.overdueCount > 0 && <Link href="/sales"><Card className="rounded-card border-rose-500/30 bg-rose-500/5 transition-shadow hover:shadow-soft-lg"><CardContent className="flex items-center gap-3 p-4"><AlertTriangle className="h-5 w-5 text-rose-600" /><div className="flex-1"><p className="text-sm font-semibold text-rose-600">{m.overdueCount} vaxtı keçmiş faktura</p><p className="text-xs text-muted-foreground">{formatCurrency(m.overdueAmount, cur)} ödənilməmiş</p></div><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></CardContent></Card></Link>}
          {m.pendingApprovals > 0 && <Link href="/workflow"><Card className="rounded-card border-primary/30 bg-primary/5 transition-shadow hover:shadow-soft-lg"><CardContent className="flex items-center gap-3 p-4"><Inbox className="h-5 w-5 text-primary" /><div className="flex-1"><p className="text-sm font-semibold text-primary">{m.pendingApprovals} təsdiq gözləyir</p><p className="text-xs text-muted-foreground">İş axını inbox-u</p></div><ArrowUpRight className="h-4 w-4 text-muted-foreground" /></CardContent></Card></Link>}
        </div>
      )}

      {/* Son fakturalar */}
      {!isHidden(cfg, 'recentInvoices') && (
      <Card className="rounded-card">
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Son fakturalar</CardTitle><Link href="/sales" className="text-sm font-medium text-primary hover:underline">Hamısı</Link></CardHeader>
        <CardContent className="p-0">
          {m.recentInvoices.length === 0 ? <Empty text="Faktura yoxdur" /> : (
            <div className="overflow-x-auto">
              <div className="grid min-w-[560px] grid-cols-[2fr_1fr_1fr_1fr] gap-2 border-b border-border px-5 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><span>Müştəri</span><span>Nömrə</span><span>Məbləğ</span><span>Status</span></div>
              {m.recentInvoices.map((s) => (
                <div key={s.id} className="grid min-w-[560px] grid-cols-[2fr_1fr_1fr_1fr] items-center gap-2 border-b border-border/50 px-5 py-2.5 text-sm last:border-0">
                  <div className="flex items-center gap-2 truncate"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{(s.customerName ?? '?').slice(0, 2).toUpperCase()}</span><span className="truncate font-medium">{s.customerName ?? '—'}</span></div>
                  <span className="truncate font-mono text-xs text-muted-foreground">{s.invoiceNumber}</span>
                  <span className="font-semibold">{formatCurrency(s.grandTotal, s.currency)}</span>
                  <span><Badge variant={s.status === 'paid' ? 'success' : s.status === 'overdue' ? 'destructive' : s.status === 'partially_paid' ? 'warning' : 'secondary'}>{s.status}</Badge></span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Qrafiklər — fərdiləşdirilə bilən (03 §5) */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold tracking-tight text-muted-foreground">Analitika</h2>
        <Button variant="outline" size="sm" onClick={() => setCustOpen(true)}><SlidersHorizontal className="h-4 w-4" /> Fərdiləşdir</Button>
      </div>
      {orderedCharts(cfg).length === 0 ? (
        <Card className="rounded-card"><Empty text="Bütün widget-lər gizlədilib — «Fərdiləşdir» ilə göstərin" /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orderedCharts(cfg).map((k) => <div key={k} className="contents">{renderChart(k, m, cur, canViewSalary)}</div>)}
        </div>
      )}

      <CustomizeDialog open={custOpen} onOpenChange={setCustOpen} cfg={cfg}
        onApply={(next) => { setCfg(next); saveDashConfig(uid, companyId, next); }} />
    </div>
  );
}

// ── Fərdiləşdirilə bilən qrafik widget-ləri (03 §5) ──
function renderChart(key: string, m: LiveCompanyKpis, cur: string, canViewSalary: boolean): ReactNode {
  switch (key) {
    case 'revenueTrend':
      return (
        <ChartCard title="Gəlir trendi və kümulyativ (6 ay)">
          {m.revenueTrend.every((x) => x.value === 0) ? <Empty text="Gəlir datası yoxdur" /> : (
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={m.revenueTrend}>
                <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={PRIMARY} stopOpacity={0.95} /><stop offset="100%" stopColor={PRIMARY} stopOpacity={0.45} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="month" fontSize={11} /><YAxis fontSize={11} width={36} />
                <Tooltip formatter={(v: number) => formatCurrency(v, cur)} />
                <Bar name="Aylıq gəlir" dataKey="value" fill="url(#barGrad)" radius={[6, 6, 0, 0]} barSize={20} />
                <Line name="Kümulyativ" type="monotone" dataKey="cumulative" stroke={CHART_COLORS[1]} strokeWidth={2.5} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      );
    case 'collection':
      return <GaugeCard title="Yığım faizi (collection)" percent={m.collectionRate} label="ödənilmiş / ümumi"
        sub={[{ label: 'Faktura sayı', value: String(m.invoiceCount) }, { label: 'Orta faktura', value: formatCurrency(m.avgInvoice, cur) }]} />;
    case 'statusDist':
      return (
        <ChartCard title="Faktura statusu (məbləğ)">
          {m.statusDist.length === 0 ? <Empty text="Faktura yoxdur" /> : (
            <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={m.statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3}>{m.statusDist.map((_, i) => <Cell key={i} stroke="transparent" fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip formatter={(v: number) => formatCurrency(v, cur)} /><Legend /></PieChart></ResponsiveContainer>
          )}
        </ChartCard>
      );
    case 'aging':
      return (
        <ChartCard title="Debitor yaş analizi">
          {m.agingBuckets.length === 0 ? <Empty text="Açıq debitor yoxdur" /> : (
            <ResponsiveContainer width="100%" height={200}><BarChart data={m.agingBuckets}><CartesianGrid strokeDasharray="3 3" className="stroke-muted" /><XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} width={36} /><Tooltip formatter={(v: number) => formatCurrency(v, cur)} /><Bar dataKey="value" radius={[6, 6, 0, 0]}>{m.agingBuckets.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer>
          )}
        </ChartCard>
      );
    case 'topCustomers':
      return (
        <ChartCard title="Top müştərilər (gəlir)">
          {m.topCustomers.length === 0 ? <Empty text="Satış datası yoxdur" /> : (
            <ResponsiveContainer width="100%" height={200}><BarChart data={m.topCustomers.map((c) => ({ name: c.name.slice(0, 10), value: c.revenue }))} layout="vertical"><XAxis type="number" fontSize={10} hide /><YAxis type="category" dataKey="name" fontSize={10} width={80} /><Tooltip formatter={(v: number) => formatCurrency(v, cur)} /><Bar dataKey="value" radius={[0, 6, 6, 0]}>{m.topCustomers.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar></BarChart></ResponsiveContainer>
          )}
        </ChartCard>
      );
    case 'summary':
      return (
        <Card className="rounded-card">
          <CardHeader><CardTitle className="text-base">İcmal</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <MiniRow icon={Receipt} label="Debitor (AR)" value={formatCurrency(m.arTotal, cur)} />
            <MiniRow icon={FileWarning} label="Kreditor (AP)" value={formatCurrency(m.apTotal, cur)} />
            <MiniRow icon={Building2} label="Anbar dəyəri" value={formatCurrency(m.inventoryValue, cur)} />
            <MiniRow icon={Users2} label="Aktiv işçi" value={formatNumber(m.activeEmployees, 0)} />
            <MiniRow icon={TrendingUp} label="Gəlir (YTD)" value={canViewSalary ? formatCurrency(m.revenueYtd, cur) : formatCurrency(m.revenueYtd, cur)} />
          </CardContent>
        </Card>
      );
    default:
      return null;
  }
}

function CustomizeDialog({ open, onOpenChange, cfg, onApply }: { open: boolean; onOpenChange: (o: boolean) => void; cfg: DashConfig; onApply: (c: DashConfig) => void }) {
  const [draft, setDraft] = useState<DashConfig>(cfg);
  useEffect(() => { if (open) setDraft(cfg); }, [open, cfg]);
  const toggle = (key: string) => setDraft((d) => ({ ...d, hidden: d.hidden.includes(key) ? d.hidden.filter((k) => k !== key) : [...d.hidden, key] }));
  const move = (i: number, dir: -1 | 1) => setDraft((d) => { const n = [...d.order]; const j = i + dir; if (j < 0 || j >= n.length) return d; [n[i], n[j]] = [n[j], n[i]]; return { ...d, order: n }; });
  const chartLabel = (k: string) => DASH_CHART_WIDGETS.find((w) => w.key === k)?.label ?? k;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Paneli fərdiləşdir</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Qrafiklər — sıra və görünüş</p>
            <div className="space-y-1.5">
              {draft.order.map((k, i) => {
                const hidden = draft.hidden.includes(k);
                return (
                  <div key={k} className="flex items-center gap-2 rounded-lg border border-border/60 p-2">
                    <div className="flex flex-col">
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="text-muted-foreground disabled:opacity-30"><ArrowUp className="h-3 w-3" /></button>
                      <button onClick={() => move(i, 1)} disabled={i === draft.order.length - 1} className="text-muted-foreground disabled:opacity-30"><ArrowDown className="h-3 w-3" /></button>
                    </div>
                    <span className={cn('flex-1 text-sm', hidden && 'text-muted-foreground line-through')}>{chartLabel(k)}</span>
                    <button onClick={() => toggle(k)} title={hidden ? 'Göstər' : 'Gizlət'} className="text-muted-foreground hover:text-foreground">{hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-primary" />}</button>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bölmələr</p>
            <div className="space-y-1.5">
              {DASH_SECTIONS.map((s) => {
                const hidden = draft.hidden.includes(s.key);
                return (
                  <label key={s.key} className="flex items-center justify-between rounded-lg border border-border/60 p-2 text-sm">
                    <span className={cn(hidden && 'text-muted-foreground line-through')}>{s.label}</span>
                    <input type="checkbox" checked={!hidden} onChange={() => toggle(s.key)} />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-row justify-between">
          <Button variant="ghost" onClick={() => setDraft({ order: DASH_CHART_WIDGETS.map((w) => w.key), hidden: [] })}><RotateCcw className="h-4 w-4" /> Sıfırla</Button>
          <Button onClick={() => { onApply(draft); onOpenChange(false); }}>Yadda saxla</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Ortaq komponentlər (Uperp tərzi) ──
function Hero({ title, sub, label, cta, avatar }: { title: string; sub: string; label: string; cta: { href: string; label: string }; avatar?: { name: string; avatarUrl?: string; editable?: boolean } }) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#6b5cf2] via-[#6a4cf3] to-[#8b3df0] p-7 text-white shadow-[0_24px_70px_-24px_rgba(91,91,245,0.6)] lg:p-9">
      <div aria-hidden className="pointer-events-none absolute inset-0"><Sparkles className="absolute right-8 top-4 h-40 w-40 text-white/[0.12]" strokeWidth={1} /><div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" /></div>
      <div className="relative flex items-center justify-between gap-6">
        <div className="min-w-0 max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">{label}</p>
          <h1 className="mt-3 text-3xl font-bold leading-[1.1] tracking-tight lg:text-[2.7rem]">{title}</h1>
          <p className="mt-2 text-sm text-white/75">{sub}</p>
          <Link href={cta.href} className="mt-6 inline-flex items-center gap-2.5 rounded-full bg-[#0d0d14] py-2.5 pl-5 pr-2.5 text-sm font-semibold text-white transition-transform hover:scale-105">{cta.label}<span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15"><ArrowRight className="h-4 w-4" /></span></Link>
        </div>
        {avatar && <div className="hidden shrink-0 sm:block"><HeroAvatar name={avatar.name} avatarUrl={avatar.avatarUrl} editable={avatar.editable} /></div>}
      </div>
    </section>
  );
}

/** Rəngli hero blokunun sağında yerləşən, yüklənə bilən profil şəkli */
function HeroAvatar({ name, avatarUrl, editable }: { name: string; avatarUrl?: string; editable?: boolean }) {
  const { inputRef, uploading, openPicker, onFile } = useAvatarUpload();
  const photo = avatarUrl
    ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
    : <div className="flex h-full w-full items-center justify-center bg-white/15 text-2xl font-bold text-white">{name.slice(0, 2).toUpperCase()}</div>;
  if (!editable) {
    return <div className="h-24 w-24 overflow-hidden rounded-full ring-4 ring-white/25 lg:h-28 lg:w-28">{photo}</div>;
  }
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <button type="button" onClick={openPicker} disabled={uploading} title="Şəkli dəyişdir"
        className="group relative h-24 w-24 rounded-full outline-none ring-4 ring-white/25 transition hover:ring-white/50 focus-visible:ring-white lg:h-28 lg:w-28">
        <span className="block h-full w-full overflow-hidden rounded-full">{photo}</span>
        <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#6a4cf3] bg-white text-[#5B5BF5] shadow-lg transition-transform group-hover:scale-110">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </span>
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
          {avatarUrl ? 'Dəyişdir' : 'Şəkil əlavə et'}
        </span>
      </button>
    </>
  );
}
function KpiCard({ icon: Icon, tint, label, value, sub }: { icon: typeof Wallet; tint: string; label: string; value: string; sub?: string }) {
  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft-lg">
      <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105', tint)}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><p className="truncate text-xl font-bold leading-tight tnum">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p>{sub && <p className="truncate text-[11px] text-muted-foreground/70">{sub}</p>}</div>
    </div>
  );
}
function StatMini({ icon: Icon, tint, value, label }: { icon: typeof Wallet; tint: string; value: string; label: string }) {
  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft-lg">
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105', tint)}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1"><p className="truncate text-lg font-bold leading-tight tnum">{value}</p><p className="truncate text-xs text-muted-foreground">{label}</p></div>
    </div>
  );
}
const FEAT_GRAD = ['from-[#5B5BF5] to-[#9333ea]', 'from-[#06b6d4] to-[#3b82f6]', 'from-[#ec4899] to-[#8b5cf6]', 'from-[#14b8a6] to-[#5B5BF5]', 'from-[#f59e0b] to-[#ec4899]', 'from-[#5B5BF5] to-[#06b6d4]'];
function CustomerCard({ name, revenue, cur, max, idx }: { name: string; revenue: number; cur: string; max: number; idx: number }) {
  const pct = max > 0 ? Math.round((revenue / max) * 100) : 0;
  return (
    <div className="flex w-[230px] shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-soft transition-all hover:-translate-y-1 hover:shadow-soft-lg">
      <div className={cn('flex min-h-[110px] flex-1 items-center justify-center rounded-xl bg-gradient-to-br p-3', FEAT_GRAD[idx % FEAT_GRAD.length])}>
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 text-2xl font-bold text-white">{name.slice(0, 2).toUpperCase()}</span>
      </div>
      <p className="mt-2.5 line-clamp-1 text-sm font-semibold">{name}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-to-r from-[#5B5BF5] to-[#8b3df0]" style={{ width: `${Math.max(6, pct)}%` }} /></div>
      <div className="mt-2 flex items-center justify-between text-xs"><span className="font-bold text-primary">{formatCurrency(revenue, cur)}</span><span className="text-muted-foreground">gəlir</span></div>
    </div>
  );
}
function AvatarRing({ name, avatarUrl, percent, editable }: { name: string; avatarUrl?: string; percent: number; editable?: boolean }) {
  const p = Math.min(100, Math.max(0, percent));
  const { inputRef, uploading, openPicker, onFile } = useAvatarUpload();
  const inner = (
    <>
      <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(#5B5BF5 ${p * 3.6}deg, rgba(127,127,127,0.14) 0deg)` }} />
      <div className="absolute inset-[7px] overflow-hidden rounded-full bg-card">
        {avatarUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={avatarUrl} alt={name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#5B5BF5] to-[#8b3df0] text-2xl font-bold text-white">{name.slice(0, 2).toUpperCase()}</div>}
      </div>
      <span className="absolute -right-1 top-1 rounded-full bg-[#5B5BF5] px-2 py-0.5 text-[11px] font-bold text-white shadow-lg">{p.toFixed(0)}%</span>
    </>
  );
  if (!editable) return <div className="relative h-28 w-28">{inner}</div>;
  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      <button type="button" onClick={openPicker} disabled={uploading} title="Şəkli dəyişdir"
        className="group relative h-28 w-28 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card">
        {inner}
        <span className="absolute bottom-[7px] right-[7px] z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-[#5B5BF5] text-white shadow-lg transition-transform group-hover:scale-110">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </span>
        <span className="pointer-events-none absolute inset-[7px] flex items-center justify-center rounded-full bg-black/45 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
          {avatarUrl ? 'Dəyişdir' : 'Şəkil əlavə et'}
        </span>
      </button>
    </>
  );
}
function GaugeCard({ title, percent, label, sub }: { title: string; percent: number; label: string; sub?: { label: string; value: string }[] }) {
  const pct = Math.min(100, Math.max(0, percent));
  return (
    <Card className="rounded-card"><CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <div className="relative">
          <ResponsiveContainer width="100%" height={160}>
            <RadialBarChart innerRadius="72%" outerRadius="100%" data={[{ name: title, value: pct }]} startAngle={90} endAngle={-270}>
              <defs><linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#5B5BF5" /><stop offset="100%" stopColor="#8b3df0" /></linearGradient></defs>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background={{ fill: 'rgba(127,127,127,0.12)' }} dataKey="value" cornerRadius={20} fill="url(#gaugeGrad)" />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-4xl font-bold tracking-tight text-primary">{pct.toFixed(0)}%</span><span className="text-xs text-muted-foreground">{label}</span></div>
        </div>
        {sub && <div className="mt-2 grid grid-cols-2 gap-2">{sub.map((s) => <div key={s.label} className="rounded-xl border border-border bg-secondary/40 p-2.5 text-center"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</p><p className="mt-0.5 text-sm font-bold">{s.value}</p></div>)}</div>}
      </CardContent>
    </Card>
  );
}
function MiniRow({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return <div className="flex items-center justify-between border-b border-border/50 py-1.5 last:border-0"><span className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" /> {label}</span><span className="text-sm font-semibold tnum">{value}</span></div>;
}
function Empty({ text }: { text: string }) { return <p className="py-12 text-center text-sm text-muted-foreground">{text}</p>; }
function KpiSkeleton() {
  return <div className="flex flex-col gap-4"><Skeleton className="h-40 rounded-3xl" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}</div><Skeleton className="h-64 rounded-3xl" /></div>;
}
