'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  Building2, Users2, Wallet, FileWarning, TrendingUp, ArrowUpRight,
  ShieldCheck, Landmark, Receipt, UserCheck, Boxes,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { loadPlatformMetrics, loadCompanyMetrics } from '@/lib/dashboard/kpi';
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

  return (
    <div className="flex flex-col gap-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#6b5cf2] via-[#6a4cf3] to-[#8b3df0] p-7 text-white shadow-[0_24px_70px_-24px_rgba(91,91,245,0.6)] lg:p-9">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
            TaxIQ · {isSuperAdmin ? t('platformTitle') : active?.company.name ?? t('companyTitle')}
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-[1.1] tracking-tight lg:text-[2.6rem]">{greet}, {firstName} 👋</h1>
          <p className="mt-2 text-sm text-white/75">
            {now.toLocaleDateString('az-AZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {active ? ` · ${active.roleName}` : ''}
          </p>
        </div>
      </section>

      {isSuperAdmin && <PlatformSection />}
      {active && <CompanySection companyId={active.companyId} canViewSalary={can('hr.employee.salary.view')} />}

      {!isSuperAdmin && !active && (
        <Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">
          Hələ heç bir şirkətə təyin olunmamısınız. Administratorla əlaqə saxlayın.
        </CardContent></Card>
      )}
    </div>
  );
}

// ═══════════ PLATFORM DASHBOARD (Super Admin) — 01 §5.1 ═══════════
function PlatformSection() {
  const { data, isLoading } = useQuery({ queryKey: ['platform-metrics'], queryFn: loadPlatformMetrics });

  if (isLoading || !data) return <KpiSkeleton />;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Building2} tint="bg-violet-500/12 text-violet-600" label="Şirkətlər" value={String(data.totalCompanies)} sub={`${data.activeCompanies} aktiv`} />
        <KpiCard icon={ShieldCheck} tint="bg-emerald-500/12 text-emerald-600" label="Aktiv" value={String(data.activeCompanies)} sub={`${data.suspendedCompanies} dayandırılıb`} />
        <KpiCard icon={Users2} tint="bg-sky-500/12 text-sky-600" label="İstifadəçilər" value={String(data.totalUsers)} sub={`${data.staffUsers} staff`} />
        <KpiCard icon={UserCheck} tint="bg-amber-500/12 text-amber-600" label="Müştəri istifadəçiləri" value={String(data.clientUsers)} sub="client users" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Sektor üzrə bölgü" className="lg:col-span-1">
          {data.sectorDistribution.length === 0 ? <Empty text="Şirkət yoxdur" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data.sectorDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                  {data.sectorDistribution.map((_, i) => <Cell key={i} stroke="transparent" fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <Card className="rounded-card lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Şirkətlər</CardTitle>
            <Link href="/companies" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Hamısı <ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </CardHeader>
          <CardContent className="p-0">
            {data.companies.length === 0 ? <Empty text="Şirkət yoxdur" /> : (
              <div className="divide-y divide-border/50">
                {data.companies.slice(0, 6).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{c.name.slice(0, 2).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name} {c.isInternal && <span className="text-xs text-primary">· Daxili</span>}</p>
                      <p className="truncate text-xs text-muted-foreground">{c.taxId ? `VÖEN ${c.taxId}` : c.sector}</p>
                    </div>
                    <Badge variant={c.status === 'active' ? 'success' : c.status === 'suspended' ? 'warning' : 'secondary'}>{c.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ═══════════ COMPANY DASHBOARD (aktiv şirkət) — 01 §5.1 / 03 §1 ═══════════
function CompanySection({ companyId, canViewSalary }: { companyId: string; canViewSalary: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ['company-metrics', companyId],
    queryFn: () => loadCompanyMetrics(companyId),
  });

  if (isLoading || !data) return <KpiSkeleton />;
  const m = data.latest;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={TrendingUp} tint="bg-violet-500/12 text-violet-600" label="Gəlir (son)" value={formatCurrency(m?.revenue ?? 0)} />
        <KpiCard icon={Wallet} tint="bg-emerald-500/12 text-emerald-600" label="Kassa/Bank qalığı" value={formatCurrency(m?.cashBalance ?? 0)} />
        <KpiCard icon={Receipt} tint="bg-sky-500/12 text-sky-600" label="Debitor (AR)" value={formatCurrency(m?.arTotal ?? 0)} />
        <KpiCard icon={FileWarning} tint="bg-rose-500/12 text-rose-600" label="Kreditor (AP)" value={formatCurrency(m?.apTotal ?? 0)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ChartCard title="Gəlir / Xərc trendi (30 gün)" className="lg:col-span-2">
          {data.trend.length === 0 ? <EmptyBuild /> : (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={data.trend}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={PRIMARY} stopOpacity={0.35} /><stop offset="100%" stopColor={PRIMARY} stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} width={40} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Area name="Gəlir" type="monotone" dataKey="revenue" stroke={PRIMARY} fill="url(#rev)" strokeWidth={2} />
                <Line name="Xərc" type="monotone" dataKey="expenses" stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <Card className="rounded-card">
          <CardHeader><CardTitle className="text-base">HR icmalı</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <MiniRow icon={Users2} label="Aktiv işçi" value={formatNumber(m?.activeEmployeeCount ?? 0, 0)} />
            <MiniRow icon={UserCheck} label="Yeni işə götürmə" value={formatNumber(m?.newHiresCount ?? 0, 0)} />
            <MiniRow icon={Boxes} label="Ehtiyat dəyəri" value={formatCurrency(m?.inventoryValue ?? 0)} />
            <MiniRow icon={Landmark} label="Xalis mənfəət" value={canViewSalary ? formatCurrency(m?.netProfit ?? 0) : '•••••'} />
          </CardContent>
        </Card>
      </div>

      {!m && <EmptyBuild inline />}
    </>
  );
}

// ─── UI helpers ───
function KpiCard({ icon: Icon, tint, label, value, sub }: { icon: typeof Wallet; tint: string; label: string; value: string; sub?: string }) {
  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-soft-lg">
      <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105', tint)}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xl font-bold leading-tight tnum">{value}</p>
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        {sub && <p className="truncate text-[11px] text-muted-foreground/70">{sub}</p>}
      </div>
    </div>
  );
}

function MiniRow({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 py-1.5 last:border-0">
      <span className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4" /> {label}</span>
      <span className="text-sm font-semibold tnum">{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-12 text-center text-sm text-muted-foreground">{text}</p>;
}

function EmptyBuild({ inline }: { inline?: boolean }) {
  const content = (
    <p className="py-10 text-center text-sm text-muted-foreground">
      KPI məlumatları Modul 5–10 (anbar, satış, mühasibat, HR) qoşulduqca və gecə aqreqasiyası işlədikcə avtomatik dolacaq.
    </p>
  );
  if (inline) return <Card className="rounded-card">{content}</Card>;
  return content;
}

function KpiSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-3xl" />
    </div>
  );
}
