'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Factory, Store, Hotel, Briefcase, PackageSearch, HardHat, Shapes,
  Check, ChevronLeft, ChevronRight, Loader2, Building2, type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { isTaxIdUnique } from '@/lib/firebase/companies';
import { listUsers } from '@/lib/firebase/users';
import { createCompanyFromOnboarding, saveDraft, type OnboardingData } from '@/lib/firebase/onboarding';
import { SECTOR_TEMPLATES, SECTOR_MAP, TOGGLEABLE_MODULES, LEGAL_FORMS } from '@/lib/sectors';
import { SYSTEM_ROLES } from '@/lib/rbac/permissions';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';
import type { CompanyModule, Sector } from '@/types';

const ICONS: Record<string, LucideIcon> = { Factory, Store, Hotel, Briefcase, PackageSearch, HardHat, Shapes };
const STEPS = ['Əsas məlumat', 'Sektor', 'Modullar', 'Tənzimləmələr', 'İlkin admin', 'Təsdiq'];

const initial: OnboardingData = {
  name: '', legalName: '', taxId: '', legalForm: 'MMC', address: '', phone: '', email: '', directorName: '',
  sector: 'services', modulesEnabled: [],
  baseCurrency: 'AZN', fiscalYearStartMonth: 1, language: 'az', brandColor: '', totalRooms: null,
  assignUserId: null, assignRoleId: null,
};

export default function NewCompanyWizard() {
  const router = useRouter();
  const { isSuperAdmin, can, profile } = useAuth();
  const allowed = isSuperAdmin || can('platform.company.create');
  const [step, setStep] = useState(0);
  const [d, setD] = useState<OnboardingData>(initial);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: users } = useQuery({ queryKey: ['users'], queryFn: listUsers, enabled: allowed && step === 4 });

  if (!allowed) {
    return <div><PageHeader title="Yeni müştəri" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Bu əməliyyat üçün «platform.company.create» icazəsi lazımdır.</CardContent></Card></div>;
  }

  const set = (patch: Partial<OnboardingData>) => setD((prev) => ({ ...prev, ...patch }));

  function pickSector(sector: Sector) {
    const tpl = SECTOR_MAP[sector];
    set({ sector, modulesEnabled: [...tpl.defaultModulesEnabled] });
  }
  function toggleModule(m: CompanyModule) {
    set({ modulesEnabled: d.modulesEnabled.includes(m) ? d.modulesEnabled.filter((x) => x !== m) : [...d.modulesEnabled, m] });
  }

  async function persistDraft(nextStep: number) {
    try {
      const id = await saveDraft(draftId, profile?.uid ?? '', nextStep, d);
      setDraftId(id);
    } catch { /* draft saxlanması kritik deyil */ }
  }

  async function next() {
    // Addım 1 validasiyası
    if (step === 0) {
      if (!d.name.trim() || !d.legalName.trim() || !d.taxId.trim()) { toast.error('Ad, hüquqi ad və VÖEN məcburidir'); return; }
      setBusy(true);
      const unique = await isTaxIdUnique(d.taxId);
      setBusy(false);
      if (!unique) { toast.error('Bu VÖEN artıq mövcuddur', 'Eyni VÖEN-lə ikinci şirkət yaradıla bilməz'); return; }
    }
    const ns = Math.min(step + 1, STEPS.length - 1);
    setStep(ns);
    persistDraft(ns);
  }
  function back() { setStep((s) => Math.max(0, s - 1)); }

  async function submit() {
    setBusy(true);
    try {
      const { companyId } = await createCompanyFromOnboarding(d, profile?.uid ?? '', draftId ?? undefined);
      toast.success('Şirkət yaradıldı', d.name);
      router.replace('/companies');
      void companyId;
    } catch (e) {
      toast.error('Xəta', e instanceof Error ? e.message : undefined);
    } finally { setBusy(false); }
  }

  const tpl = SECTOR_MAP[d.sector];

  return (
    <div>
      <PageHeader title="Yeni müştəri qeydiyyatı" subtitle="Daxili məlumat daxiletmə sihirbazı (02 §1)" />

      {/* Addım göstəricisi */}
      <div className="mb-6 flex items-center gap-1 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className={cn('flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap',
              i === step ? 'bg-primary text-primary-foreground' : i < step ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
              <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[11px]', i === step ? 'bg-white/20' : i < step ? 'bg-primary/20' : 'bg-background')}>
                {i < step ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {s}
            </div>
            {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          </div>
        ))}
      </div>

      <Card className="rounded-card">
        <CardContent className="p-6">
          {/* ── Addım 1 ── */}
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Şirkətin adı (qısa) *"><Input value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Bakı Retail Group" /></Field>
              <Field label="Hüquqi adı (tam) *"><Input value={d.legalName} onChange={(e) => set({ legalName: e.target.value })} /></Field>
              <Field label="VÖEN *"><Input value={d.taxId} onChange={(e) => set({ taxId: e.target.value })} placeholder="10 rəqəm" maxLength={10} /></Field>
              <Field label="Hüquqi forma">
                <Select value={d.legalForm} onValueChange={(v) => set({ legalForm: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{LEGAL_FORMS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Ünvan"><Input value={d.address} onChange={(e) => set({ address: e.target.value })} /></Field>
              <Field label="Telefon"><Input value={d.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
              <Field label="E-poçt"><Input type="email" value={d.email} onChange={(e) => set({ email: e.target.value })} /></Field>
              <Field label="Rəhbərin adı"><Input value={d.directorName} onChange={(e) => set({ directorName: e.target.value })} /></Field>
            </div>
          )}

          {/* ── Addım 2 ── */}
          {step === 1 && (
            <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
              <div className="grid gap-3 sm:grid-cols-2">
                {SECTOR_TEMPLATES.map((s) => {
                  const Icon = ICONS[s.icon] ?? Shapes;
                  const active = d.sector === s.code;
                  return (
                    <button key={s.code} onClick={() => pickSector(s.code)}
                      className={cn('flex items-start gap-3 rounded-card border p-4 text-left transition-all', active ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:border-primary/40')}>
                      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', active ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary')}><Icon className="h-5 w-5" /></span>
                      <span className="min-w-0">
                        <span className="block font-semibold">{s.name.az}</span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">{s.description.az}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <aside className="rounded-card border border-dashed border-border p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bu sektor üçün defolt</p>
                <p className="mt-2 text-sm font-medium">{tpl.name.az}</p>
                <div className="mt-3 space-y-2 text-sm">
                  <p className="text-muted-foreground">Aktiv modullar: <span className="font-medium text-foreground">{tpl.defaultModulesEnabled.length || 'heç biri'}</span></p>
                  <p className="text-muted-foreground">Şöbələr: <span className="font-medium text-foreground">{tpl.departmentPreset.map((x) => x.az).join(', ') || '—'}</span></p>
                  <p className="text-muted-foreground">Tövsiyə KPI: <span className="font-medium text-foreground">{tpl.recommendedKpis.length}</span></p>
                </div>
                <p className="mt-3 text-xs text-muted-foreground/80">{tpl.notes.az}</p>
              </aside>
            </div>
          )}

          {/* ── Addım 3 ── */}
          {step === 2 && (
            <div>
              <p className="mb-4 text-sm text-muted-foreground">Dashboard və Rol/Səlahiyyət həmişə aktivdir. Aşağıdakı modulları müqaviləyə uyğun fərdiləşdirin (02 §2.2).</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {TOGGLEABLE_MODULES.map((m) => {
                  const on = d.modulesEnabled.includes(m.key);
                  return (
                    <button key={m.key} onClick={() => toggleModule(m.key)}
                      className={cn('flex items-center justify-between rounded-card border p-3 text-left transition-colors', on ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-secondary')}>
                      <span className="text-sm font-medium">{m.label.az}</span>
                      <span className={cn('flex h-5 w-5 items-center justify-center rounded-md border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>{on && <Check className="h-3.5 w-3.5" />}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Addım 4 ── */}
          {step === 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Əsas valyuta"><Input value={d.baseCurrency} onChange={(e) => set({ baseCurrency: e.target.value.toUpperCase() })} maxLength={3} /></Field>
              <Field label="Fiskal il başlanğıcı (ay)">
                <Select value={String(d.fiscalYearStartMonth)} onValueChange={(v) => set({ fiscalYearStartMonth: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Array.from({ length: 12 }).map((_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Dil (şirkət defoltu)">
                <Select value={d.language} onValueChange={(v) => set({ language: v as 'az' | 'en' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="az">Azərbaycanca</SelectItem><SelectItem value="en">English</SelectItem></SelectContent>
                </Select>
              </Field>
              <Field label="Brend rəngi (hex, opsional)"><Input value={d.brandColor} onChange={(e) => set({ brandColor: e.target.value })} placeholder="#5B5BF5" /></Field>
              {d.sector === 'hospitality' && (
                <Field label="Ümumi otaq sayı (RevPAR/ADR üçün)"><Input type="number" value={d.totalRooms ?? ''} onChange={(e) => set({ totalRooms: e.target.value ? Number(e.target.value) : null })} /></Field>
              )}
            </div>
          )}

          {/* ── Addım 5 ── */}
          {step === 4 && (
            <div className="max-w-lg space-y-4">
              <p className="text-sm text-muted-foreground">Opsional: mövcud istifadəçini bu şirkətə təyin edin. Keçə bilərsiniz — sonra İstifadəçilər bölməsindən əlavə edərsiniz (02 §1.2 addım 5).</p>
              <Field label="İstifadəçi">
                <Select value={d.assignUserId ?? ''} onValueChange={(v) => set({ assignUserId: v })}>
                  <SelectTrigger><SelectValue placeholder="İstifadəçi seç (opsional)" /></SelectTrigger>
                  <SelectContent>{(users ?? []).filter((u) => u.userType !== 'platform_super_admin').map((u) => <SelectItem key={u.uid} value={u.uid}>{u.displayName} ({u.email})</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Rol">
                <Select value={d.assignRoleId ?? ''} onValueChange={(v) => set({ assignRoleId: v })}>
                  <SelectTrigger><SelectValue placeholder="Rol seç" /></SelectTrigger>
                  <SelectContent>{SYSTEM_ROLES.filter((r) => r.code !== 'platform_super_admin').map((r) => <SelectItem key={r.code} value={r.code}>{r.name.az}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
          )}

          {/* ── Addım 6 ── */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-card bg-primary/5 p-4">
                <Building2 className="h-6 w-6 text-primary" />
                <div><p className="font-semibold">{d.name}</p><p className="text-sm text-muted-foreground">{d.legalName} · VÖEN {d.taxId}</p></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Summary label="Sektor" value={tpl.name.az} />
                <Summary label="Hüquqi forma" value={d.legalForm} />
                <Summary label="Əsas valyuta" value={d.baseCurrency} />
                <Summary label="Fiskal il başlanğıcı" value={`${d.fiscalYearStartMonth}-ci ay`} />
                <Summary label="Aktiv modullar" value={d.modulesEnabled.length ? d.modulesEnabled.join(', ') : 'yalnız platform nüvəsi'} />
                <Summary label="Şöbələr (avtomatik)" value={tpl.departmentPreset.map((x) => x.az).join(', ') || '—'} />
              </div>
              <p className="text-xs text-muted-foreground">«Yarat» düyməsi: şirkət (status: active), sektora uyğun şöbələr və seçilibsə ilkin admin təyinatı yaradılır; audit jurnalına yazılır.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex items-center justify-between">
        <Button variant="outline" onClick={back} disabled={step === 0 || busy}><ChevronLeft className="h-4 w-4" /> Geri</Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : null} Növbəti <ChevronRight className="h-4 w-4" /></Button>
        ) : (
          <Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Check className="h-4 w-4" />} Yarat</Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border/60 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-medium">{value}</p></div>;
}
