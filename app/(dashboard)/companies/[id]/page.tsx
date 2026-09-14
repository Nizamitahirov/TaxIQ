'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save, Plus, Trash2, ShieldAlert, Building2, Download, Database } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { getCompany, updateCompany } from '@/lib/firebase/companies';
import { listDepartments, createDepartment, deleteDepartment } from '@/lib/firebase/departments';
import { buildCompanyExport } from '@/lib/firebase/company-export';
import { exportWorkbook } from '@/lib/utils/export';
import { logAudit } from '@/lib/firebase/audit';
import { TOGGLEABLE_MODULES, SECTOR_MAP } from '@/lib/sectors';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils/cn';
import type { Company, CompanyModule, CompanyStatus, Department } from '@/types';

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isSuperAdmin, can, profile } = useAuth();
  const allowed = isSuperAdmin || can('platform.company.settings.edit');
  const { data: company, isLoading } = useQuery({ queryKey: ['company', id], queryFn: () => getCompany(id), enabled: allowed });

  if (!allowed) return <div><PageHeader title="Şirkət" /><Card className="rounded-card"><CardContent className="flex flex-col items-center gap-3 py-16 text-center"><ShieldAlert className="h-8 w-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">İcazə yoxdur.</p></CardContent></Card></div>;
  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!company) return <div><PageHeader title="Şirkət" /><p className="text-sm text-muted-foreground">Şirkət tapılmadı.</p></div>;

  return (
    <div>
      <PageHeader
        title={company.name}
        subtitle={`${company.legalName ?? ''} ${company.taxId ? `· VÖEN ${company.taxId}` : ''}`}
        action={<Badge variant={company.status === 'active' ? 'success' : company.status === 'suspended' ? 'warning' : 'secondary'}>{company.status}</Badge>}
      />
      <Tabs defaultValue="general">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="general">Ümumi</TabsTrigger>
          <TabsTrigger value="modules">Modullar</TabsTrigger>
          <TabsTrigger value="departments">Şöbələr</TabsTrigger>
          <TabsTrigger value="export">İxrac</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="lifecycle">Status</TabsTrigger>}
        </TabsList>
        <TabsContent value="general"><GeneralTab company={company} actorUid={profile?.uid ?? ''} /></TabsContent>
        <TabsContent value="modules"><ModulesTab company={company} actorUid={profile?.uid ?? ''} /></TabsContent>
        <TabsContent value="departments"><DepartmentsTab companyId={company.id} /></TabsContent>
        <TabsContent value="export"><ExportTab company={company} actorUid={profile?.uid ?? ''} /></TabsContent>
        {isSuperAdmin && <TabsContent value="lifecycle"><LifecycleTab company={company} actorUid={profile?.uid ?? ''} /></TabsContent>}
      </Tabs>
    </div>
  );
}

function GeneralTab({ company, actorUid }: { company: Company; actorUid: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: company.name, legalName: company.legalName ?? '', address: company.address ?? '',
    phone: company.phone ?? '', email: company.email ?? '', directorName: company.directorName ?? '',
    brandColor: company.brandColor ?? '',
  });
  // Sektora xas sahələr (yalnız 'company' entity) — 02 §7
  const companyFields = (SECTOR_MAP[company.sector]?.customFieldDefinitions ?? []).filter((f) => f.appliesToEntity === 'company');
  const [custom, setCustom] = useState<Record<string, string>>(() =>
    Object.fromEntries(companyFields.map((f) => [f.fieldKey, String(company.customFieldValues?.[f.fieldKey] ?? '')])));
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  const setCf = (k: string, v: string) => setCustom((c) => ({ ...c, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const customFieldValues: Record<string, string | number> = { ...(company.customFieldValues as Record<string, string | number> ?? {}) };
      for (const f of companyFields) {
        const raw = custom[f.fieldKey] ?? '';
        customFieldValues[f.fieldKey] = f.type === 'number' ? (Number(raw) || 0) : raw;
      }
      await updateCompany(company.id, { ...form, ...(companyFields.length ? { customFieldValues } : {}) });
      await logAudit({ companyId: company.id, userId: actorUid, action: 'COMPANY_UPDATED', entityType: 'company', entityId: company.id });
      qc.invalidateQueries({ queryKey: ['company', company.id] });
      toast.success('Yadda saxlanıldı');
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Card className="rounded-card"><CardContent className="p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <F label="Ad"><Input value={form.name} onChange={(e) => set({ name: e.target.value })} /></F>
        <F label="Hüquqi ad"><Input value={form.legalName} onChange={(e) => set({ legalName: e.target.value })} /></F>
        <F label="Ünvan"><Input value={form.address} onChange={(e) => set({ address: e.target.value })} /></F>
        <F label="Telefon"><Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} /></F>
        <F label="E-poçt"><Input value={form.email} onChange={(e) => set({ email: e.target.value })} /></F>
        <F label="Rəhbər"><Input value={form.directorName} onChange={(e) => set({ directorName: e.target.value })} /></F>
        <F label="Brend rəngi"><Input value={form.brandColor} onChange={(e) => set({ brandColor: e.target.value })} placeholder="#5B5BF5" /></F>
      </div>

      {companyFields.length > 0 && (
        <div className="mt-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sektora xas məlumatlar</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {companyFields.map((f) => (
              <F key={f.fieldKey} label={f.label.az}>
                {f.type === 'select' ? (
                  <Select value={custom[f.fieldKey] ?? ''} onValueChange={(v) => setCf(f.fieldKey, v)}>
                    <SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                    <SelectContent>{(f.options ?? []).map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} value={custom[f.fieldKey] ?? ''} onChange={(e) => setCf(f.fieldKey, e.target.value)} />
                )}
              </F>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" /> Sektor: {SECTOR_MAP[company.sector]?.name.az ?? company.sector} · Valyuta: {company.baseCurrency}
      </div>
      <div className="mt-4"><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />} Yadda saxla</Button></div>
    </CardContent></Card>
  );
}

function ExportTab({ company, actorUid }: { company: Company; actorUid: string }) {
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const { sheets, totalRows } = await buildCompanyExport(company.id);
      const safe = company.name.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
      exportWorkbook(`taxiq-${safe}-tam-ixrac`, sheets);
      await logAudit({ companyId: company.id, userId: actorUid, action: 'COMPANY_DATA_EXPORTED', entityType: 'company', entityId: company.id, after: { rows: totalRows } });
      toast.success('Tam data ixrac edildi', `${sheets.length} modul · ${totalRows} sətir`);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }
  return (
    <Card className="rounded-card"><CardContent className="max-w-xl p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Database className="h-5 w-5" /></span>
        <div>
          <p className="font-semibold">Şirkətin tam data ixracı</p>
          <p className="mt-1 text-sm text-muted-foreground">Bütün modullar üzrə məlumat (mühasibat, satış, anbar, kassa/bank, HR, əmək haqqı və s.) tək çoxvərəqli Excel faylına ixrac olunur — hər kolleksiya ayrı vərəq. Müqavilə bitdikdə arxivləşdirmə və audit üçün (02 §5).</p>
        </div>
      </div>
      <div className="mt-5"><Button onClick={run} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Download className="h-4 w-4" />} Tam ixracı yüklə (.xlsx)</Button></div>
    </CardContent></Card>
  );
}

function ModulesTab({ company, actorUid }: { company: Company; actorUid: string }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState<CompanyModule[]>(company.modulesEnabled ?? []);
  const [saving, setSaving] = useState(false);
  const toggle = (m: CompanyModule) => setEnabled((e) => e.includes(m) ? e.filter((x) => x !== m) : [...e, m]);

  async function save() {
    setSaving(true);
    try {
      await updateCompany(company.id, { modulesEnabled: enabled });
      await logAudit({ companyId: company.id, userId: actorUid, action: 'COMPANY_MODULES_CHANGED', entityType: 'company', entityId: company.id, after: { modules: enabled } });
      qc.invalidateQueries({ queryKey: ['company', company.id] });
      toast.success('Modullar yeniləndi', 'Dəyişiklik yalnız naviqasiyanı təsir edir; məlumat silinmir.');
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Card className="rounded-card"><CardContent className="p-6">
      <p className="mb-4 text-sm text-muted-foreground">Dashboard/RBAC həmişə aktivdir. Modul söndürüldükdə məlumat silinmir, yalnız naviqasiyadan gizlədilir (02 §3).</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {TOGGLEABLE_MODULES.map((m) => {
          const on = enabled.includes(m.key);
          return (
            <button key={m.key} onClick={() => toggle(m.key)} className={cn('flex items-center justify-between rounded-card border p-3 text-left transition-colors', on ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-secondary')}>
              <span className="text-sm font-medium">{m.label.az}</span>
              <span className={cn('flex h-5 w-5 items-center justify-center rounded-md border', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}>{on && '✓'}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4"><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />} Yadda saxla</Button></div>
    </CardContent></Card>
  );
}

function DepartmentsTab({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['departments', companyId], queryFn: () => listDepartments(companyId) });
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) { toast.error('Ad tələb olunur'); return; }
    setBusy(true);
    try {
      await createDepartment({ companyId, name: { az: name.trim(), en: name.trim() }, code: code.trim() || name.slice(0, 3).toUpperCase(), parentDepartmentId: null, type: 'department', isActive: true });
      setName(''); setCode('');
      qc.invalidateQueries({ queryKey: ['departments', companyId] });
      toast.success('Şöbə əlavə edildi');
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }
  async function remove(d: Department) {
    setBusy(true);
    try { await deleteDepartment(d.id); qc.invalidateQueries({ queryKey: ['departments', companyId] }); toast.success('Silindi'); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  return (
    <Card className="rounded-card"><CardContent className="p-6">
      <p className="mb-4 text-sm text-muted-foreground">Şöbələr/dimensiyalar — hesabat kəsimi üçün (02 §4).</p>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="space-y-1"><Label className="text-xs">Ad</Label><Input value={name} onChange={(e) => setName(e.target.value)} className="w-48" /></div>
        <div className="space-y-1"><Label className="text-xs">Kod</Label><Input value={code} onChange={(e) => setCode(e.target.value)} className="w-28" placeholder="D01" /></div>
        <Button onClick={add} disabled={busy} size="sm"><Plus className="h-4 w-4" /> Əlavə et</Button>
      </div>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (data ?? []).length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Şöbə yoxdur</p>
      ) : (
        <div className="space-y-1.5">
          {(data ?? []).map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2.5">
              <span className="text-sm"><span className="font-medium">{d.name.az}</span> <span className="text-xs text-muted-foreground">· {d.code} · {d.type}</span></span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" disabled={busy} onClick={() => remove(d)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
    </CardContent></Card>
  );
}

function LifecycleTab({ company, actorUid }: { company: Company; actorUid: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [status, setStatus] = useState<CompanyStatus>(company.status);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  async function apply() {
    if (status === company.status) { toast.info('Status dəyişməyib'); return; }
    if (!reason.trim()) { toast.error('Səbəb tələb olunur (02 §6.3)'); return; }
    setSaving(true);
    try {
      await updateCompany(company.id, { status, statusReason: reason.trim() });
      await logAudit({ companyId: company.id, userId: actorUid, action: 'COMPANY_STATUS_CHANGED', entityType: 'company', entityId: company.id, before: { status: company.status }, after: { status, reason } });
      qc.invalidateQueries({ queryKey: ['company', company.id] });
      qc.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Status dəyişdirildi');
      router.refresh();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Card className="rounded-card"><CardContent className="max-w-lg p-6">
      <p className="mb-4 text-sm text-muted-foreground">Status axını: draft → active → suspended ⇄ active → archived. Şirkət heç vaxt fiziki silinmir (02 §6.2).</p>
      <div className="space-y-4">
        <F label="Status">
          <Select value={status} onValueChange={(v) => setStatus(v as CompanyStatus)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">draft</SelectItem>
              <SelectItem value="active">active</SelectItem>
              <SelectItem value="suspended">suspended</SelectItem>
              <SelectItem value="archived">archived</SelectItem>
            </SelectContent>
          </Select>
        </F>
        <F label="Səbəb *"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Müqavilə dayandırıldı / ..." /></F>
        <Button onClick={apply} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />} Tətbiq et</Button>
        <p className="text-xs text-muted-foreground">Qeyd: suspended → Client User girişi bloklanır, Staff yalnız oxuma; archived → yalnız arxiv/ixrac. Tam token ləğvi (revokeRefreshTokens) Cloud Function tələb edir (gələcək).</p>
      </div>
    </CardContent></Card>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
