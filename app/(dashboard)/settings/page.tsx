'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Building2, Coins, Receipt, User, LayoutGrid } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { loadCardStyle, saveCardStyle, type CardStyle } from '@/lib/dashboard/card-style';
import { listDocs } from '@/lib/firebase/firestore';
import { getActiveTaxConfig, saveTaxConfig } from '@/lib/firebase/hr';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import type { Currency, PayrollTaxConfig } from '@/types';

export default function SettingsPage() {
  const { active, isSuperAdmin, can } = useAuth();
  const canManageTax = isSuperAdmin || can('payroll.run.approve') || can('platform.company.settings.edit');

  return (
    <div>
      <PageHeader title="Tənzimləmələr" subtitle={active?.company.name ?? ''} />
      <Tabs defaultValue="company">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="company">Şirkət</TabsTrigger>
          <TabsTrigger value="currencies">Valyutalar</TabsTrigger>
          <TabsTrigger value="tax">Əmək haqqı vergisi</TabsTrigger>
          <TabsTrigger value="prefs">Tərcihlər</TabsTrigger>
        </TabsList>
        <TabsContent value="company"><CompanyTab /></TabsContent>
        <TabsContent value="currencies"><CurrenciesTab /></TabsContent>
        <TabsContent value="tax"><TaxTab canManage={canManageTax} /></TabsContent>
        <TabsContent value="prefs"><PrefsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function CompanyTab() {
  const { active, isSuperAdmin } = useAuth();
  return (
    <Card className="rounded-card"><CardContent className="p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-6 w-6" /></span>
        <div><p className="font-semibold">{active?.company.name}</p><p className="text-sm text-muted-foreground">{active?.company.legalName} {active?.company.taxId ? `· VÖEN ${active.company.taxId}` : ''}</p></div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
        <Info label="Sektor" value={active?.company.sector ?? '—'} />
        <Info label="Əsas valyuta" value={active?.company.baseCurrency ?? '—'} />
        <Info label="Status" value={active?.company.status ?? '—'} />
      </div>
      {isSuperAdmin && active && (
        <Link href={`/companies/${active.companyId}`} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">Şirkət profilini idarə et →</Link>
      )}
    </CardContent></Card>
  );
}

function CurrenciesTab() {
  const { data, isLoading } = useQuery({ queryKey: ['currencies'], queryFn: () => listDocs<Currency>('currencies') });
  return (
    <Card className="rounded-card"><CardContent className="p-6">
      <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><Coins className="h-4 w-4" /> Qlobal valyuta siyahısı (01 §8.1)</p>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Valyuta yoxdur. Seed skripti valyutaları qurur.</p>
      ) : (
        <div className="flex flex-wrap gap-2">{(data ?? []).map((c) => <span key={c.id} className="rounded-full border border-border bg-card px-3 py-1 text-sm">{c.symbol} {c.isoCode} · {c.name?.az}</span>)}</div>
      )}
    </CardContent></Card>
  );
}

function TaxTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const { data: cfg, isLoading } = useQuery({ queryKey: ['taxcfg'], queryFn: getActiveTaxConfig });
  const [form, setForm] = useState<PayrollTaxConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const c = form ?? cfg;

  if (isLoading || !c) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const edit = (patch: Partial<PayrollTaxConfig>) => setForm({ ...c, ...patch });

  async function save() {
    if (!c) return;
    setSaving(true);
    try {
      await saveTaxConfig({ ...c, effectiveFrom: c.effectiveFrom });
      toast.success('Vergi konfiqurasiyası saxlanıldı', 'Yeni versiya effektiv oldu');
      qc.invalidateQueries({ queryKey: ['taxcfg'] });
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Card className="rounded-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Receipt className="h-4 w-4 text-primary" /> Əmək haqqı vergi/sığorta konfiqurasiyası (versiyalanan, 10 §6.1)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-card bg-warning/10 p-3 text-xs text-warning-foreground">⚠️ Dərəcələr tez-tez dəyişir — taxes.gov.az/DSMF-dən təsdiqlənməlidir. Dəyişiklik yeni versiya kimi saxlanılır; keçmiş dövrlər öz versiyalarında qalır.</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <F label="Effektiv tarix"><Input type="date" value={c.effectiveFrom} onChange={(e) => edit({ effectiveFrom: e.target.value })} disabled={!canManage} /></F>
          <F label="Minimum əmək haqqı"><Input type="number" value={c.minimumWage} onChange={(e) => edit({ minimumWage: Number(e.target.value) })} disabled={!canManage} /></F>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Gəlir vergisi pillələri</Label>
          <div className="mt-2 space-y-2">
            {c.incomeTaxBrackets.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-32 text-muted-foreground">{b.uptoAmount == null ? 'üzəri' : `≤ ${b.uptoAmount} ₼`}</span>
                <Input className="w-24" type="number" step="0.01" value={b.rate} disabled={!canManage} onChange={(e) => { const br = [...c.incomeTaxBrackets]; br[i] = { ...br[i], rate: Number(e.target.value) }; edit({ incomeTaxBrackets: br }); }} />
                <span className="text-xs text-muted-foreground">dərəcə · sabit</span>
                <Input className="w-24" type="number" value={b.fixedAmount} disabled={!canManage} onChange={(e) => { const br = [...c.incomeTaxBrackets]; br[i] = { ...br[i], fixedAmount: Number(e.target.value) }; edit({ incomeTaxBrackets: br }); }} />
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <Info label="Sosial (işçi ilk 200₼ / üzəri)" value={`${(c.socialInsurance.employeeBaseRate * 100).toFixed(1)}% / ${(c.socialInsurance.employeeRateAboveThreshold * 100).toFixed(1)}%`} />
          <Info label="Sosial (işəgötürən)" value={`${(c.socialInsurance.employerRate * 100).toFixed(1)}%`} />
          <Info label="Tibbi (≤2500 / üzəri)" value={`${(c.medicalInsurance.employeeRateLowerBand * 100).toFixed(1)}% / ${(c.medicalInsurance.employeeRateUpperBand * 100).toFixed(1)}%`} />
          <Info label="İşsizlik (işçi/işəgötürən)" value={`${(c.unemploymentInsurance.employeeRate * 100).toFixed(1)}% / ${(c.unemploymentInsurance.employerRate * 100).toFixed(1)}%`} />
        </div>
        {canManage && <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />} Yeni versiya kimi saxla</Button>}
      </CardContent>
    </Card>
  );
}

function PrefsTab() {
  const { profile } = useAuth();
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('theme') ?? 'system'; } catch { return 'system'; } });
  const [cardStyle, setCardStyle] = useState<CardStyle>('gradient');
  useEffect(() => { setCardStyle(loadCardStyle()); }, []);
  function applyCardStyle(s: CardStyle) { setCardStyle(s); saveCardStyle(s); }
  function apply(next: string) {
    setTheme(next);
    try {
      if (next === 'dark') { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
      else if (next === 'light') { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
      else { localStorage.removeItem('theme'); document.documentElement.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches); }
    } catch { /* ignore */ }
  }
  function setLang(l: string) { document.cookie = `NEXT_LOCALE=${l}; path=/; max-age=31536000`; location.reload(); }

  return (
    <Card className="rounded-card"><CardContent className="space-y-5 p-6">
      <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><User className="h-5 w-5" /></span><div><p className="font-medium">{profile?.displayName}</p><p className="text-sm text-muted-foreground">{profile?.email}</p></div></div>
      <div className="space-y-2">
        <Label>Tema</Label>
        <div className="flex gap-2">{['light', 'dark', 'system'].map((th) => <Button key={th} variant={theme === th ? 'default' : 'outline'} size="sm" onClick={() => apply(th)}>{th === 'light' ? 'Açıq' : th === 'dark' ? 'Tünd' : 'Sistem'}</Button>)}</div>
      </div>
      <div className="space-y-2">
        <Label>Dil</Label>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setLang('az')}>🇦🇿 Azərbaycanca</Button><Button variant="outline" size="sm" onClick={() => setLang('en')}>🇬🇧 English</Button></div>
      </div>
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Bölmə kartlarının görünüşü <span className="font-normal text-muted-foreground">(Bölmələr səhifəsi)</span></Label>
        <div className="grid max-w-md grid-cols-2 gap-3">
          <CardStyleOption active={cardStyle === 'gradient'} onClick={() => applyCardStyle('gradient')} label="Rəngli">
            <div className="h-full w-full rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]" />
          </CardStyleOption>
          <CardStyleOption active={cardStyle === 'minimal'} onClick={() => applyCardStyle('minimal')} label="Sadə (ağ + abstrakt)">
            <div className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-card">
              <div className="absolute -right-2 -top-3 h-10 w-10 rounded-full opacity-50 blur-lg" style={{ background: 'rgba(99,102,241,0.5)' }} />
              <div className="absolute left-2 top-2 h-4 w-4 rounded-md bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]" />
            </div>
          </CardStyleOption>
        </div>
        <p className="text-xs text-muted-foreground">Dəyişiklik Bölmələr səhifəsinə keçəndə tətbiq olunur.</p>
      </div>
    </CardContent></Card>
  );
}

function CardStyleOption({ active, onClick, label, children }: { active: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-xl border p-2 text-left transition-colors ${active ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/40'}`}>
      <div className="h-16 w-full">{children}</div>
      <p className={`mt-2 text-xs font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>{label}</p>
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-border/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 font-medium">{value}</p></div>; }
function F({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
