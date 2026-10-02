'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Calculator, Plane, LogOut, CalendarDays } from 'lucide-react';
import { listEmployees, calcEmployeeLeavePay, calcEmployeeSeverance } from '@/lib/firebase/hr';
import {
  totalLeaveEntitlement, serviceYearsBetween, type BasicLeaveCategory, type SeveranceKind,
} from '@/lib/payroll/average-salary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency } from '@/lib/utils/format';
import type { Employee } from '@/types';

interface Props { companyId: string; baseCurrency: string }

export function CalculatorsTab({ companyId, baseCurrency }: Props) {
  const tt = useTT();
  const { data: employees, isLoading } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId) });
  const emps = (employees ?? []).filter((e) => e.status === 'active');

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {tt('Əmək Məcəlləsi əsaslı hesablamalar — orta əmək haqqı (m.140/177), məzuniyyət pulu, əlavə məzuniyyət (m.115–119), işdənçıxma müavinəti (m.77).',
            'Labour-Code calculations — average wage (Art.140/177), leave pay, additional leave (Art.115–119), severance (Art.77).')}
      </p>
      <div className="grid gap-5 lg:grid-cols-2">
        <LeavePayCard companyId={companyId} baseCurrency={baseCurrency} emps={emps} />
        <SeveranceCard companyId={companyId} baseCurrency={baseCurrency} emps={emps} />
      </div>
      <EntitlementCard emps={emps} />
    </div>
  );
}

// ── Məzuniyyət pulu (m.140) ─────────────────────────────────
function LeavePayCard({ companyId, baseCurrency, emps }: { companyId: string; baseCurrency: string; emps: Employee[] }) {
  const tt = useTT();
  const [employeeId, setEmployeeId] = useState('');
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState('21');
  const [res, setRes] = useState<{ daily: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    const emp = emps.find((e) => e.id === employeeId);
    if (!emp) { toast.error(tt('İşçi seçin', 'Select an employee')); return; }
    setBusy(true);
    try {
      setRes(await calcEmployeeLeavePay(companyId, emp, Number(days) || 0, start));
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Card className="rounded-card">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-primary" /> {tt('Məzuniyyət pulu', 'Leave pay')} <Badge variant="secondary">m.140</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2"><Label>{tt('İşçi', 'Employee')}</Label>
          <Select value={employeeId} onValueChange={(v) => { setEmployeeId(v); setRes(null); }}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
            <SelectContent>{emps.map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>{tt('Başlanğıc', 'Start date')}</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Təqvim günləri', 'Calendar days')}</Label><Input type="number" value={days} onChange={(e) => setDays(e.target.value)} /></div>
        </div>
        <Button size="sm" onClick={run} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />} {tt('Hesabla', 'Calculate')}</Button>
        {res && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">{tt('Bir günlük orta (÷30.4)', 'Daily average (÷30.4)')}</span><span className="tnum font-medium">{formatCurrency(res.daily, baseCurrency)}</span></div>
            <div className="mt-1 flex justify-between border-t pt-1"><span className="font-medium">{tt('Məzuniyyət pulu', 'Leave pay')}</span><span className="tnum font-semibold text-primary">{formatCurrency(res.total, baseCurrency)}</span></div>
            <p className="mt-2 text-xs text-muted-foreground">{tt('Əvvəlki 12 təqvim ayının orta əmək haqqına əsasən. Məzuniyyətə ən geci 3 gün qalmış ödənilir (m.140.5).', 'Based on the preceding 12 months. Paid at latest 3 days before leave starts (Art.140.5).')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── İşdənçıxma müavinəti (m.77) ─────────────────────────────
const SEV_KINDS: { v: SeveranceKind; az: string; en: string }[] = [
  { v: 'redundancy', az: 'Ştat ixtisarı / say azaldılması (m.77.3)', en: 'Redundancy (Art.77.3)' },
  { v: 'special2x', az: 'm.68.2.c, 74.1.a/c — 2 misli (m.77.7)', en: 'Art.77.7 — 2×' },
  { v: 'special3x', az: 'm.68.2.ç, 74.1.a — 3 misli (m.77.7)', en: 'Art.77.7 — 3×' },
  { v: 'death', az: 'Vəfat — vərəsələrə 3 misli (m.77.7)', en: 'Death — heirs 3× (Art.77.7)' },
];

function SeveranceCard({ companyId, baseCurrency, emps }: { companyId: string; baseCurrency: string; emps: Employee[] }) {
  const tt = useTT();
  const [employeeId, setEmployeeId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [kind, setKind] = useState<SeveranceKind>('redundancy');
  const [res, setRes] = useState<{ averageMonthly: number; serviceYears: number; noticeWeeks: number; multiplier: number; amount: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    const emp = emps.find((e) => e.id === employeeId);
    if (!emp) { toast.error(tt('İşçi seçin', 'Select an employee')); return; }
    setBusy(true);
    try {
      setRes(await calcEmployeeSeverance(companyId, emp, date, kind));
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Card className="rounded-card">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><LogOut className="h-4 w-4 text-primary" /> {tt('İşdənçıxma müavinəti', 'Severance pay')} <Badge variant="secondary">m.77</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2"><Label>{tt('İşçi', 'Employee')}</Label>
          <Select value={employeeId} onValueChange={(v) => { setEmployeeId(v); setRes(null); }}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
            <SelectContent>{emps.map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>{tt('Xitam tarixi', 'Termination date')}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Əsas', 'Basis')}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as SeveranceKind)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SEV_KINDS.map((k) => <SelectItem key={k.v} value={k.v}>{tt(k.az, k.en)}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
        <Button size="sm" onClick={run} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />} {tt('Hesabla', 'Calculate')}</Button>
        {res && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">{tt('Orta aylıq əmək haqqı', 'Average monthly wage')}</span><span className="tnum">{formatCurrency(res.averageMonthly, baseCurrency)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{tt('Əmək stajı', 'Service')}</span><span className="tnum">{res.serviceYears} {tt('il', 'yr')}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{tt('Xəbərdarlıq müddəti', 'Notice period')}</span><span className="tnum">{res.noticeWeeks} {tt('həftə', 'weeks')}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{tt('Əmsal', 'Multiplier')}</span><span className="tnum">{res.multiplier}×</span></div>
            <div className="flex justify-between border-t pt-1"><span className="font-medium">{tt('Müavinət', 'Severance')}</span><span className="tnum font-semibold text-primary">{formatCurrency(res.amount, baseCurrency)}</span></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Əlavə məzuniyyət günləri (m.115–119) ────────────────────
const BASIC_CATS: { v: BasicLeaveCategory; az: string; en: string }[] = [
  { v: 'standard', az: 'Ümumi — 21 gün (m.114.2)', en: 'Standard — 21 days' },
  { v: 'extended30', az: 'Genişləndirilmiş — 30 gün (m.114.3)', en: 'Extended — 30 days' },
  { v: 'pedagogical56', az: 'Pedaqoji/elmi — 56 gün (m.118.1)', en: 'Pedagogical — 56 days' },
  { v: 'pedagogical42', az: 'Pedaqoji/elmi — 42 gün (m.118.2)', en: 'Pedagogical — 42 days' },
  { v: 'physio42', az: 'Fizioloji — 42 gün (m.119)', en: 'Physiological — 42 days' },
  { v: 'physio35', az: 'Fizioloji — 35 gün (m.119)', en: 'Physiological — 35 days' },
  { v: 'special46', az: 'Xüsusi xidmət — 46 gün (m.120)', en: 'Special service — 46 days' },
];

function EntitlementCard({ emps }: { emps: Employee[] }) {
  const tt = useTT();
  const [employeeId, setEmployeeId] = useState('');
  const [basic, setBasic] = useState<BasicLeaveCategory>('standard');
  const [children, setChildren] = useState('0');
  const [disabledChild, setDisabledChild] = useState(false);
  const [hazardous, setHazardous] = useState('0');
  const [liberated, setLiberated] = useState(false);
  const [excludeSeniority, setExcludeSeniority] = useState(false);

  const emp = emps.find((e) => e.id === employeeId);
  const serviceYears = emp?.hireDate ? serviceYearsBetween(emp.hireDate) : 0;
  const result = totalLeaveEntitlement(basic, {
    serviceYears, childrenUnder14: Number(children) || 0, hasDisabledChild: disabledChild,
    hazardousDays: Number(hazardous) || 0, liberatedTerritory: liberated, excludeSeniority,
  });
  const pedagogical = basic.startsWith('pedagogical') || basic === 'physio42' || basic === 'physio35' || basic === 'special46';

  return (
    <Card className="rounded-card">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Plane className="h-4 w-4 text-primary" /> {tt('Məzuniyyət hüququ (əsas + əlavə)', 'Leave entitlement (basic + additional)')} <Badge variant="secondary">m.114–119</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2"><Label>{tt('İşçi', 'Employee')}</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger><SelectValue placeholder={tt('Seç (staj avtomatik)', 'Select (auto seniority)')} /></SelectTrigger>
              <SelectContent>{emps.map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>{tt('Əsas məzuniyyət', 'Basic leave')}</Label>
            <Select value={basic} onValueChange={(v) => setBasic(v as BasicLeaveCategory)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{BASIC_CATS.map((c) => <SelectItem key={c.v} value={c.v}>{tt(c.az, c.en)}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>{tt('Əmək stajı (il)', 'Service (years)')}</Label><Input value={emp ? serviceYears.toFixed(1) : '—'} disabled /></div>
          <div className="space-y-2"><Label>{tt('14 yaşadək uşaq sayı', 'Children under 14')}</Label><Input type="number" value={children} onChange={(e) => setChildren(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Əmək şəraitinə görə gün (m.115)', 'Hazardous days (Art.115)')}</Label><Input type="number" value={hazardous} onChange={(e) => setHazardous(e.target.value)} /></div>
          <div className="flex flex-col justify-end gap-2 pb-1 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={disabledChild} onChange={(e) => setDisabledChild(e.target.checked)} /> {tt('Əlilliyi olan uşaq', 'Has disabled child')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={liberated} onChange={(e) => setLiberated(e.target.checked)} /> {tt('İşğaldan azad ərazi (m.118-1)', 'Liberated territory')}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={excludeSeniority || pedagogical} disabled={pedagogical} onChange={(e) => setExcludeSeniority(e.target.checked)} /> {tt('Staj/uşaq əlavəsi verilmir (m.116.3)', 'No seniority/childcare add-on')}</label>
          </div>
        </div>
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">{tt('Əsas məzuniyyət', 'Basic leave')}</span><span className="tnum">{result.basicDays} {tt('gün', 'days')}</span></div>
          {result.additional.map((a) => (
            <div key={a.label} className="flex justify-between"><span className="text-muted-foreground">{a.label}</span><span className="tnum">+{a.days}</span></div>
          ))}
          <div className="mt-1 flex justify-between border-t pt-1"><span className="font-medium">{tt('Cəmi illik məzuniyyət', 'Total annual leave')}</span><span className="tnum font-semibold text-primary">{result.totalDays} {tt('təqvim günü', 'cal. days')}</span></div>
        </div>
      </CardContent>
    </Card>
  );
}
