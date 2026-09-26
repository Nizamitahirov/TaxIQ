'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Building2, Coins, Receipt, User, LayoutGrid, ImageUp, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { ImportTab } from './import-tab';
import { loadCardStyle, saveCardStyle, type CardStyle } from '@/lib/dashboard/card-style';
import { listDocs } from '@/lib/firebase/firestore';
import { getActiveTaxConfig, saveTaxConfig } from '@/lib/firebase/hr';
import { updateCompany } from '@/lib/firebase/companies';
import { resizeLogoToDataUrl } from '@/lib/utils/image';
import { logAudit } from '@/lib/firebase/audit';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import type { Currency, PayrollTaxConfig } from '@/types';

export default function SettingsPage() {
  const { active, isSuperAdmin, can } = useAuth();
  const tt = useTT();
  const canManageTax = isSuperAdmin || can('payroll.run.approve') || can('platform.company.settings.edit');

  return (
    <div>
      <PageHeader title={tt('Tənzimləmələr', 'Settings')} subtitle={active?.company.name ?? ''} />
      <Tabs defaultValue="company">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="company">{tt('Şirkət', 'Company')}</TabsTrigger>
          <TabsTrigger value="currencies">{tt('Valyutalar', 'Currencies')}</TabsTrigger>
          <TabsTrigger value="tax">{tt('Əmək haqqı vergisi', 'Payroll tax')}</TabsTrigger>
          <TabsTrigger value="prefs">{tt('Tərcihlər', 'Preferences')}</TabsTrigger>
          <TabsTrigger value="import">{tt('Excel idxal', 'Excel import')}</TabsTrigger>
        </TabsList>
        <TabsContent value="company"><CompanyTab /></TabsContent>
        <TabsContent value="currencies"><CurrenciesTab /></TabsContent>
        <TabsContent value="tax"><TaxTab canManage={canManageTax} /></TabsContent>
        <TabsContent value="prefs"><PrefsTab /></TabsContent>
        <TabsContent value="import"><ImportTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function CompanyTab() {
  const { active, isSuperAdmin, can, profile, refresh } = useAuth();
  const tt = useTT();
  const canEdit = isSuperAdmin || can('platform.company.settings.edit');
  const company = active?.company;
  const [director, setDirector] = useState(company?.directorName ?? '');
  const [logoUrl, setLogoUrl] = useState(company?.logoUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  // active şirkət dəyişəndə formu sinxronlaşdır
  const [key, setKey] = useState('');
  const k = company?.id ?? '';
  if (k !== key && company) { setKey(k); setDirector(company.directorName ?? ''); setLogoUrl(company.logoUrl ?? ''); }

  async function onLogo(file?: File) {
    if (!file || !company) return;
    if (!/^image\//.test(file.type)) { toast.error(tt('Şəkil faylı seçin', 'Select an image file')); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error(tt('Maksimum 5 MB', 'Max 5 MB')); return; }
    setUploading(true);
    try {
      // Klient tərəfdə kiçildib data URL kimi saxlayırıq (Firebase Storage tələb etmir)
      const dataUrl = await resizeLogoToDataUrl(file);
      setLogoUrl(dataUrl);
      toast.success(tt('Logo hazırdır — yadda saxlayın', 'Logo ready — save to apply'));
    }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setUploading(false); }
  }

  async function save() {
    if (!company) return;
    setBusy(true);
    try {
      await updateCompany(company.id, { directorName: director.trim(), logoUrl: logoUrl || null } as Record<string, unknown>);
      await logAudit({ companyId: company.id, userId: profile?.uid ?? '', action: 'COMPANY_UPDATED', entityType: 'company', entityId: company.id, after: { directorName: director.trim(), logo: !!logoUrl } });
      await refresh();
      toast.success(tt('Yadda saxlanıldı', 'Saved'));
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  return (
    <Card className="rounded-card"><CardContent className="p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Building2 className="h-6 w-6" /></span>
        <div><p className="font-semibold">{company?.name}</p><p className="text-sm text-muted-foreground">{company?.legalName} {company?.taxId ? `· VÖEN ${company.taxId}` : ''}</p></div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
        <Info label={tt('Sektor', 'Sector')} value={company?.sector ?? '—'} />
        <Info label={tt('Əsas valyuta', 'Base currency')} value={company?.baseCurrency ?? '—'} />
        <Info label="Status" value={company?.status ?? '—'} />
      </div>

      {/* Faktura üçün logo + direktor (redaktə oluna bilir) — 06 §4 */}
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{tt('Şirkət loqosu (faktura üçün)', 'Company logo (for invoices)')}</Label>
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-secondary/40">
              {logoUrl ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={logoUrl} alt="logo" className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-muted-foreground">{tt('Logo yoxdur', 'No logo')}</span>}
            </div>
            {canEdit && (
              <div className="flex flex-col gap-1.5">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-button border border-border px-3 py-1.5 text-sm hover:bg-secondary">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />} {tt('Yüklə', 'Upload')}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { onLogo(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                {logoUrl && <button type="button" onClick={() => setLogoUrl('')} className="inline-flex items-center gap-1 text-xs text-danger hover:underline"><Trash2 className="h-3.5 w-3.5" /> {tt('Sil', 'Remove')}</button>}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{tt('PNG/JPG, maks. 2 MB. Faktura başlığında və çapında istifadə olunur.', 'PNG/JPG, max 2 MB. Used in the invoice header and print.')}</p>
        </div>
        <div className="space-y-2">
          <Label>{tt('Baş Direktor (faktura imzası)', 'Director (invoice signature)')}</Label>
          <Input value={director} onChange={(e) => setDirector(e.target.value)} disabled={!canEdit} placeholder={tt('Ad Soyad', 'Full name')} />
          <p className="text-xs text-muted-foreground">{tt('Faktura və rəsmi sənədlərdə imza sətrində göstərilir. Qeydiyyatda da təyin edilə bilər.', 'Shown on the signature line in invoices and official documents. Can also be set at registration.')}</p>
        </div>
      </div>

      {canEdit ? (
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={save} disabled={busy || uploading}>{busy ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />} {tt('Yadda saxla', 'Save')}</Button>
          {isSuperAdmin && company && <Link href={`/companies/${company.id}`} className="text-sm font-medium text-primary hover:underline">{tt('Tam profil →', 'Full profile →')}</Link>}
        </div>
      ) : (
        <p className="mt-4 text-xs text-muted-foreground">{tt('Dəyişiklik üçün «platform.company.settings.edit» icazəsi lazımdır.', 'The «platform.company.settings.edit» permission is required to edit.')}</p>
      )}
    </CardContent></Card>
  );
}

function CurrenciesTab() {
  const tt = useTT();
  const { data, isLoading } = useQuery({ queryKey: ['currencies'], queryFn: () => listDocs<Currency>('currencies') });
  return (
    <Card className="rounded-card"><CardContent className="p-6">
      <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground"><Coins className="h-4 w-4" /> {tt('Qlobal valyuta siyahısı (01 §8.1)', 'Global currency list (01 §8.1)')}</p>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{tt('Valyuta yoxdur. Seed skripti valyutaları qurur.', 'No currencies. The seed script sets up currencies.')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">{(data ?? []).map((c) => <span key={c.id} className="rounded-full border border-border bg-card px-3 py-1 text-sm">{c.symbol} {c.isoCode} · {c.name ? tt(c.name.az, c.name.en) : ''}</span>)}</div>
      )}
    </CardContent></Card>
  );
}

function TaxTab({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const tt = useTT();
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
      toast.success(tt('Vergi konfiqurasiyası saxlanıldı', 'Tax configuration saved'), tt('Yeni versiya effektiv oldu', 'The new version is now effective'));
      qc.invalidateQueries({ queryKey: ['taxcfg'] });
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Card className="rounded-card"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Receipt className="h-4 w-4 text-primary" /> {tt('Əmək haqqı vergi/sığorta konfiqurasiyası (versiyalanan, 10 §6.1)', 'Payroll tax/insurance configuration (versioned, 10 §6.1)')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-card bg-warning/10 p-3 text-xs text-warning-foreground">{tt('⚠️ Dərəcələr tez-tez dəyişir — taxes.gov.az/DSMF-dən təsdiqlənməlidir. Dəyişiklik yeni versiya kimi saxlanılır; keçmiş dövrlər öz versiyalarında qalır.', '⚠️ Rates change often — verify with taxes.gov.az/DSMF. A change is stored as a new version; past periods keep their own versions.')}</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <F label={tt('Effektiv tarix', 'Effective date')}><Input type="date" value={c.effectiveFrom} onChange={(e) => edit({ effectiveFrom: e.target.value })} disabled={!canManage} /></F>
          <F label={tt('Minimum əmək haqqı', 'Minimum wage')}><Input type="number" value={c.minimumWage} onChange={(e) => edit({ minimumWage: Number(e.target.value) })} disabled={!canManage} /></F>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">{tt('Gəlir vergisi pillələri', 'Income tax brackets')}</Label>
          <div className="mt-2 space-y-2">
            {c.incomeTaxBrackets.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="w-32 text-muted-foreground">{b.uptoAmount == null ? tt('üzəri', 'above') : `≤ ${b.uptoAmount} ₼`}</span>
                <Input className="w-24" type="number" step="0.01" value={b.rate} disabled={!canManage} onChange={(e) => { const br = [...c.incomeTaxBrackets]; br[i] = { ...br[i], rate: Number(e.target.value) }; edit({ incomeTaxBrackets: br }); }} />
                <span className="text-xs text-muted-foreground">{tt('dərəcə · sabit', 'rate · fixed')}</span>
                <Input className="w-24" type="number" value={b.fixedAmount} disabled={!canManage} onChange={(e) => { const br = [...c.incomeTaxBrackets]; br[i] = { ...br[i], fixedAmount: Number(e.target.value) }; edit({ incomeTaxBrackets: br }); }} />
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <Info label={tt('Sosial (işçi ilk 200₼ / üzəri)', 'Social (employee first 200₼ / above)')} value={`${(c.socialInsurance.employeeBaseRate * 100).toFixed(1)}% / ${(c.socialInsurance.employeeRateAboveThreshold * 100).toFixed(1)}%`} />
          <Info label={tt('Sosial (işəgötürən)', 'Social (employer)')} value={`${(c.socialInsurance.employerRate * 100).toFixed(1)}%`} />
          <Info label={tt('Tibbi (≤2500 / üzəri)', 'Medical (≤2500 / above)')} value={`${(c.medicalInsurance.employeeRateLowerBand * 100).toFixed(1)}% / ${(c.medicalInsurance.employeeRateUpperBand * 100).toFixed(1)}%`} />
          <Info label={tt('İşsizlik (işçi/işəgötürən)', 'Unemployment (employee/employer)')} value={`${(c.unemploymentInsurance.employeeRate * 100).toFixed(1)}% / ${(c.unemploymentInsurance.employerRate * 100).toFixed(1)}%`} />
        </div>
        {canManage && <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />} {tt('Yeni versiya kimi saxla', 'Save as new version')}</Button>}
      </CardContent>
    </Card>
  );
}

function PrefsTab() {
  const { profile } = useAuth();
  const tt = useTT();
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
        <Label>{tt('Tema', 'Theme')}</Label>
        <div className="flex gap-2">{['light', 'dark', 'system'].map((th) => <Button key={th} variant={theme === th ? 'default' : 'outline'} size="sm" onClick={() => apply(th)}>{th === 'light' ? tt('Açıq', 'Light') : th === 'dark' ? tt('Tünd', 'Dark') : tt('Sistem', 'System')}</Button>)}</div>
      </div>
      <div className="space-y-2">
        <Label>{tt('Dil', 'Language')}</Label>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => setLang('az')}>🇦🇿 Azərbaycanca</Button><Button variant="outline" size="sm" onClick={() => setLang('en')}>🇬🇧 English</Button></div>
      </div>
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> {tt('Bölmə kartlarının görünüşü', 'Section card appearance')} <span className="font-normal text-muted-foreground">{tt('(Bölmələr səhifəsi)', '(Sections page)')}</span></Label>
        <div className="grid max-w-md grid-cols-2 gap-3">
          <CardStyleOption active={cardStyle === 'gradient'} onClick={() => applyCardStyle('gradient')} label={tt('Rəngli', 'Colorful')}>
            <div className="h-full w-full rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]" />
          </CardStyleOption>
          <CardStyleOption active={cardStyle === 'minimal'} onClick={() => applyCardStyle('minimal')} label={tt('Sadə (ağ + abstrakt)', 'Minimal (white + abstract)')}>
            <div className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-card">
              <div className="absolute -right-2 -top-3 h-10 w-10 rounded-full opacity-50 blur-lg" style={{ background: 'rgba(99,102,241,0.5)' }} />
              <div className="absolute left-2 top-2 h-4 w-4 rounded-md bg-gradient-to-br from-[#6366f1] to-[#8b5cf6]" />
            </div>
          </CardStyleOption>
        </div>
        <p className="text-xs text-muted-foreground">{tt('Dəyişiklik Bölmələr səhifəsinə keçəndə tətbiq olunur.', 'The change applies when you go to the Sections page.')}</p>
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
