'use client';

import { useState } from 'react';
import { Calculator, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  simplifiedTax, withholdingTax, propertyTax, averageAnnualValue, propertyAdvance,
  applyMicroExemption, microExemptionEligible, latePaymentInterest, thresholdStatus,
  AZ_TAX_RATES, type SimplifiedKind, type WithholdingKind,
} from '@/lib/tax/az-taxes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency } from '@/lib/utils/format';

const n = (v: string) => Number(v) || 0;

export function TaxCalculators({ cur, rolling12mTurnover }: { cur: string; rolling12mTurnover: number }) {
  const tt = useTT();
  return (
    <div className="mt-8">
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">{tt('Vergi kalkulyatorları — Vergi Məcəlləsi', 'Tax calculators — Tax Code')}</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <ThresholdMonitor cur={cur} rolling={rolling12mTurnover} />
        <SimplifiedCalc cur={cur} />
        <WithholdingCalc cur={cur} />
        <PropertyCalc cur={cur} />
        <MicroCalc cur={cur} />
        <PenaltyCalc cur={cur} />
      </div>
    </div>
  );
}

// ── ƏDV / sadələşdirilmiş hədd monitoru (m.155/218) ─────────
function ThresholdMonitor({ cur, rolling }: { cur: string; rolling: number }) {
  const tt = useTT();
  const s = thresholdStatus(rolling);
  return (
    <Card className="rounded-card">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base">{s.vatRegistrationRequired ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />} {tt('ƏDV qeydiyyatı həddi', 'VAT registration threshold')} <Badge variant="secondary">200.000</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-1 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">{tt('Ardıcıl 12 ay dövriyyə', 'Rolling 12-month turnover')}</span><span className="tnum font-medium">{formatCurrency(s.rolling12mTurnover, cur)}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">{tt('Hədədək qalır', 'Headroom')}</span><span className={`tnum ${s.headroom < 0 ? 'text-danger' : ''}`}>{formatCurrency(s.headroom, cur)}</span></div>
        <div className="mt-2 rounded-md border p-2 text-xs">
          {s.vatRegistrationRequired
            ? tt('⚠ 200.000 AZN keçilib — ƏDV qeydiyyatı məcburidir (m.155).', '⚠ Over 200,000 AZN — VAT registration is mandatory (Art.155).')
            : s.simplifiedEligible
              ? tt('✓ Sadələşdirilmiş vergi rejimi mümkündür (m.218).', '✓ Eligible for the simplified-tax regime (Art.218).')
              : tt('Könüllü ƏDV qeydiyyatı mümkündür.', 'Voluntary VAT registration is available.')}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Sadələşdirilmiş vergi (m.220) ───────────────────────────
function SimplifiedCalc({ cur }: { cur: string }) {
  const tt = useTT();
  const [turnover, setTurnover] = useState('100000');
  const [kind, setKind] = useState<SimplifiedKind>('general');
  const tax = simplifiedTax(n(turnover), kind);
  const rate = kind === 'trade' ? 6 : kind === 'catering' ? 8 : 2;
  return (
    <Card className="rounded-card">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4 text-primary" /> {tt('Sadələşdirilmiş vergi', 'Simplified tax')} <Badge variant="secondary">m.220</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>{tt('Dövriyyə', 'Turnover')}</Label><Input type="number" value={turnover} onChange={(e) => setTurnover(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Fəaliyyət', 'Activity')}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as SimplifiedKind)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">{tt('Ümumi — 2%', 'General — 2%')}</SelectItem>
                <SelectItem value="trade">{tt('Ticarət — 6%', 'Trade — 6%')}</SelectItem>
                <SelectItem value="catering">{tt('İctimai iaşə — 8%', 'Catering — 8%')}</SelectItem>
              </SelectContent></Select>
          </div>
        </div>
        <Result label={tt(`Vergi (${rate}%)`, `Tax (${rate}%)`)} value={formatCurrency(tax, cur)} />
      </CardContent>
    </Card>
  );
}

// ── Ödəmə mənbəyində vergi (m.122-125) ──────────────────────
const WH_KINDS: { v: WithholdingKind; az: string; en: string; pct: number }[] = [
  { v: 'dividend', az: 'Dividend', en: 'Dividend', pct: 5 },
  { v: 'interest', az: 'Faiz', en: 'Interest', pct: 10 },
  { v: 'rentCommercial', az: 'İcarə (əmlak)', en: 'Rent (property)', pct: 14 },
  { v: 'rentResidential', az: 'Kirayə (yaşayış)', en: 'Residential rent', pct: 10 },
  { v: 'royalty', az: 'Royalti', en: 'Royalty', pct: 14 },
  { v: 'leaseInsurance', az: 'Lizinq / sığorta', en: 'Lease / insurance', pct: 4 },
];
function WithholdingCalc({ cur }: { cur: string }) {
  const tt = useTT();
  const [amount, setAmount] = useState('1000');
  const [kind, setKind] = useState<WithholdingKind>('dividend');
  const r = withholdingTax(n(amount), kind);
  return (
    <Card className="rounded-card">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4 text-primary" /> {tt('Ödəmə mənbəyində vergi', 'Withholding tax')} <Badge variant="secondary">m.122–125</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>{tt('Ödəniş məbləği', 'Payment amount')}</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Növ', 'Type')}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as WithholdingKind)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{WH_KINDS.map((k) => <SelectItem key={k.v} value={k.v}>{tt(k.az, k.en)} — {k.pct}%</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
        <Result label={tt(`Tutulan vergi (${(r.rate * 100).toFixed(0)}%)`, `Withheld (${(r.rate * 100).toFixed(0)}%)`)} value={formatCurrency(r.tax, cur)} />
        <div className="flex justify-between text-sm text-muted-foreground"><span>{tt('Ödəniləcək (net)', 'Net payable')}</span><span className="tnum">{formatCurrency(r.net, cur)}</span></div>
      </CardContent>
    </Card>
  );
}

// ── Əmlak vergisi (m.199-201) ───────────────────────────────
function PropertyCalc({ cur }: { cur: string }) {
  const tt = useTT();
  const [opening, setOpening] = useState('100000');
  const [closing, setClosing] = useState('80000');
  const avg = averageAnnualValue(n(opening), n(closing));
  const tax = propertyTax(avg);
  return (
    <Card className="rounded-card">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4 text-primary" /> {tt('Əmlak vergisi', 'Property tax')} <Badge variant="secondary">m.199 · 1%</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>{tt('İl əvvəli qalıq dəyər', 'Opening residual')}</Label><Input type="number" value={opening} onChange={(e) => setOpening(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('İl sonu qalıq dəyər', 'Closing residual')}</Label><Input type="number" value={closing} onChange={(e) => setClosing(e.target.value)} /></div>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground"><span>{tt('Orta illik dəyər', 'Average annual value')}</span><span className="tnum">{formatCurrency(avg, cur)}</span></div>
        <Result label={tt('İllik əmlak vergisi (1%)', 'Annual property tax (1%)')} value={formatCurrency(tax, cur)} />
        <div className="flex justify-between text-sm text-muted-foreground"><span>{tt('Rüblük cari ödəniş (20%)', 'Quarterly advance (20%)')}</span><span className="tnum">{formatCurrency(propertyAdvance(tax), cur)}</span></div>
      </CardContent>
    </Card>
  );
}

// ── Mikro güzəşt (m.102.1.30 / 106.1.20) ────────────────────
function MicroCalc({ cur }: { cur: string }) {
  const tt = useTT();
  const [tax, setTax] = useState('10000');
  const [employees, setEmployees] = useState('3');
  const [hasDebt, setHasDebt] = useState(false);
  const eligible = microExemptionEligible(n(employees), hasDebt);
  const r = applyMicroExemption(n(tax), eligible);
  return (
    <Card className="rounded-card">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4 text-primary" /> {tt('Mikro sahibkar güzəşti', 'Micro-business relief')} <Badge variant="secondary">75%</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>{tt('Hesablanmış vergi', 'Tax before relief')}</Label><Input type="number" value={tax} onChange={(e) => setTax(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Orta aylıq işçi sayı', 'Avg monthly employees')}</Label><Input type="number" value={employees} onChange={(e) => setEmployees(e.target.value)} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hasDebt} onChange={(e) => setHasDebt(e.target.checked)} /> {tt('DSMF borcu var', 'Has social-insurance debt')}</label>
        <div className="rounded-md border p-2 text-xs">{eligible ? tt('✓ Güzəşt şərtləri ödənilir (≥3 işçi, borc yoxdur).', '✓ Eligible (≥3 employees, no debt).') : tt('✗ Güzəşt şərtləri ödənilmir.', '✗ Not eligible.')}</div>
        <div className="flex justify-between text-sm text-muted-foreground"><span>{tt('Azadolma (75%)', 'Exemption (75%)')}</span><span className="tnum">{formatCurrency(r.exemption, cur)}</span></div>
        <Result label={tt('Ödəniləcək vergi', 'Tax payable')} value={formatCurrency(r.taxAfter, cur)} />
      </CardContent>
    </Card>
  );
}

// ── Gecikmə faizi (m.59.1) ──────────────────────────────────
function PenaltyCalc({ cur }: { cur: string }) {
  const tt = useTT();
  const [amount, setAmount] = useState('10000');
  const [days, setDays] = useState('30');
  const interest = latePaymentInterest(n(amount), n(days));
  return (
    <Card className="rounded-card">
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Calculator className="h-4 w-4 text-primary" /> {tt('Gecikmə faizi', 'Late-payment interest')} <Badge variant="secondary">m.59 · 0.1%/{tt('gün', 'day')}</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>{tt('Ödənilməmiş vergi', 'Unpaid tax')}</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Gecikmə (gün)', 'Days late')}</Label><Input type="number" value={days} onChange={(e) => setDays(e.target.value)} /></div>
        </div>
        <Result label={tt('Hesablanmış faiz', 'Accrued interest')} value={formatCurrency(interest, cur)} />
        <p className="text-xs text-muted-foreground">{tt('Maksimum 1 il (365 gün) üçün hesablanır.', 'Capped at 1 year (365 days).')}</p>
      </CardContent>
    </Card>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
      <span className="text-sm font-medium">{label}</span>
      <span className="tnum text-base font-semibold text-primary">{value}</span>
    </div>
  );
}
