'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Plus, Power, Trash2, Workflow as WfIcon, Inbox, ArrowUpRight, Info,
  FlaskConical, Check, X, History, CheckCircle2, XCircle, Clock, PlayCircle,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  listWorkflows, createWorkflow, deleteWorkflow, toggleWorkflow, aggregatePendingApprovals,
  listApprovalTasks, decideApprovalTask, listWorkflowRuns,
} from '@/lib/firebase/workflow';
import { simulateWorkflow } from '@/lib/workflow/engine';
import { WORKFLOW_TEMPLATES, WORKFLOW_TEMPLATE_MAP } from '@/lib/workflow/templates';
import { REPORTABLE_ENTITIES } from '@/lib/reports/entities';
import { SYSTEM_ROLES } from '@/lib/rbac/permissions';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { ExportButton } from '@/components/shared/export-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import type { WorkflowDefinition, WorkflowCondition, WorkflowAction, ApprovalTask, WorkflowRun } from '@/types';

const COND_OPS: WorkflowCondition['operator'][] = ['=', '!=', '>', '<', '>=', '<=', 'contains', 'is_empty', 'is_not_empty'];
const ms = (ts: unknown) => (ts as { toMillis?: () => number })?.toMillis?.() ?? null;

export default function WorkflowPage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const companyId = active?.companyId;
  const canManage = isSuperAdmin || can('workflow.designer.manage');

  if (!companyId) return <div><PageHeader title="İş axını" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Aktiv şirkət seçin.</CardContent></Card></div>;

  return (
    <div>
      <PageHeader title="İş axını" subtitle={`${active?.company.name} · avtomatlaşdırma və təsdiqlər (Modul 4)`} />
      <Tabs defaultValue="tasks">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="tasks">Tapşırıqlarım</TabsTrigger>
          <TabsTrigger value="inbox">Təsdiq inbox-u</TabsTrigger>
          <TabsTrigger value="defs">Workflow-lar</TabsTrigger>
          <TabsTrigger value="runs">İcra tarixçəsi</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks"><TasksTab companyId={companyId} actorUid={profile?.uid ?? ''} /></TabsContent>
        <TabsContent value="inbox"><InboxTab companyId={companyId} /></TabsContent>
        <TabsContent value="defs"><DefsTab companyId={companyId} canManage={canManage} actorUid={profile?.uid ?? ''} /></TabsContent>
        <TabsContent value="runs"><RunsTab companyId={companyId} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════ Tapşırıqlarım (approvalTasks) ═══════════
function TasksTab({ companyId, actorUid }: { companyId: string; actorUid: string }) {
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['approvalTasks', companyId], queryFn: () => listApprovalTasks(companyId) });
  const pending = (data ?? []).filter((t) => t.status === 'pending');

  async function decide(t: ApprovalTask, approve: boolean) {
    setBusyId(t.id);
    try {
      const comment = approve ? null : (window.prompt('Rədd səbəbi (opsional):') ?? '');
      await decideApprovalTask(t, approve, actorUid, comment || null);
      toast.success(approve ? 'Təsdiqləndi' : 'Rədd edildi', 'Workflow icrası davam etdi');
      qc.invalidateQueries({ queryKey: ['approvalTasks', companyId] });
      qc.invalidateQueries({ queryKey: ['workflowRuns', companyId] });
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusyId(null); }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">Aktiv workflow-lar tərəfindən yaradılan təsdiq tapşırıqları. Vəzifələrin ayrılması (SoD): öz yaratdığınız sənədi təsdiqləyə bilməzsiniz.</p>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : pending.length === 0 ? (
        <EmptyState title="Təsdiq tapşırığı yoxdur 🟢" description="Aktiv workflow trigger olduqda təsdiq tapşırıqları burada görünəcək." />
      ) : (
        <div className="space-y-2">
          {pending.map((t) => (
            <Card key={t.id} className="rounded-card"><CardContent className="flex flex-wrap items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Inbox className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.title}</p>
                <p className="truncate text-xs text-muted-foreground">Rol: {SYSTEM_ROLES.find((r) => r.code === t.approverRoleId)?.name.az ?? t.approverRoleId} · {t.mode}{t.relatedEntityType ? ` · ${t.relatedEntityType}` : ''}{t.dueAt ? ` · son: ${t.dueAt}` : ''}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="text-success" disabled={busyId === t.id} onClick={() => decide(t, true)}>{busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Təsdiqlə</Button>
                <Button variant="ghost" size="sm" className="text-danger" disabled={busyId === t.id} onClick={() => decide(t, false)}><X className="h-4 w-4" /> Rədd</Button>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════ Təsdiq inbox-u (aggregated) ═══════════
function InboxTab({ companyId }: { companyId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['pendingApprovals', companyId], queryFn: () => aggregatePendingApprovals(companyId) });
  return (
    <div>
      <div className="mb-4 flex items-start gap-2 rounded-card border border-info/20 bg-info/5 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        Diqqət tələb edən elementlər bütün modullardan birləşdirilir (məzuniyyət, əmək haqqı, faktura/kreditor draft-ları).
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Təsdiq gözləyən element yoxdur 🟢" />
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((p) => (
            <Link key={`${p.kind}-${p.id}`} href={p.link}>
              <Card className="rounded-card transition-shadow hover:shadow-soft-lg"><CardContent className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Inbox className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{p.title}</p><p className="truncate text-xs text-muted-foreground">{p.subtitle}</p></div>
                {p.amount != null && <span className="shrink-0 text-sm font-semibold tnum">{formatCurrency(p.amount, p.currency ?? 'AZN')}</span>}
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </CardContent></Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════ İcra tarixçəsi (workflowRuns) ═══════════
const RUN_ICON = { completed: CheckCircle2, failed: XCircle, cancelled: XCircle, waiting_approval: Clock, running: PlayCircle } as const;
function RunsTab({ companyId }: { companyId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['workflowRuns', companyId], queryFn: () => listWorkflowRuns(companyId) });
  const [open, setOpen] = useState<WorkflowRun | null>(null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Bütün workflow icraları tam tarixçə ilə (04 §8).</p>
        <ExportButton filename="workflow-icralari" rows={data ?? []} columns={[
          { header: 'Workflow', value: 'workflowName' }, { header: 'Status', value: 'status' },
          { header: 'Trigger', value: (r) => r.triggeredBy.type }, { header: 'Obyekt', value: (r) => r.triggeredBy.entityType ?? '' },
          { header: 'Addım sayı', value: (r) => r.history.length }, { header: 'Başlanğıc', value: (r) => { const t = ms(r.startedAt); return t ? formatDateTime(t) : ''; } },
        ]} />
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="İcra tarixçəsi boşdur" description="Aktiv workflow trigger olduqda icralar burada görünəcək." />
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((r) => {
            const Icon = RUN_ICON[r.status] ?? History;
            const color = r.status === 'completed' ? 'text-success' : r.status === 'failed' || r.status === 'cancelled' ? 'text-danger' : 'text-warning';
            return (
              <button key={r.id} onClick={() => setOpen(r)} className="w-full text-left">
                <Card className="rounded-card transition-shadow hover:shadow-soft-lg"><CardContent className="flex items-center gap-3 p-4">
                  <Icon className={`h-5 w-5 shrink-0 ${color}`} />
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{r.workflowName}</p><p className="truncate text-xs text-muted-foreground">{r.triggeredBy.type} · {r.history.length} addım · {(() => { const t = ms(r.startedAt); return t ? formatDateTime(t) : ''; })()}</p></div>
                  <Badge variant={r.status === 'completed' ? 'success' : r.status === 'failed' || r.status === 'cancelled' ? 'destructive' : 'warning'}>{r.status}</Badge>
                </CardContent></Card>
              </button>
            );
          })}
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{open?.workflowName} — icra timeline</DialogTitle></DialogHeader>
          <ol className="space-y-2">
            {(open?.history ?? []).map((h, i) => (
              <li key={i} className="flex items-start gap-3 rounded-lg border border-border/60 p-2.5">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${h.result === 'success' ? 'bg-success/15 text-success' : h.result === 'failure' ? 'bg-danger/15 text-danger' : h.result === 'pending' ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium">{h.label}</p><p className="text-xs text-muted-foreground">{h.type} · {h.result}{h.detail ? ` · ${h.detail}` : ''}</p></div>
              </li>
            ))}
          </ol>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════ Workflow-lar (defs + builder + test) ═══════════
function DefsTab({ companyId, canManage, actorUid }: { companyId: string; canManage: boolean; actorUid: string }) {
  const qc = useQueryClient();
  const [pick, setPick] = useState(false);
  const [build, setBuild] = useState(false);
  const [test, setTest] = useState<WorkflowDefinition | null>(null);
  const [del, setDel] = useState<WorkflowDefinition | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['workflows', companyId], queryFn: () => listWorkflows(companyId) });
  function invalidate() { qc.invalidateQueries({ queryKey: ['workflows', companyId] }); }

  async function instantiate(templateId: string) {
    const tpl = WORKFLOW_TEMPLATE_MAP[templateId]; if (!tpl) return;
    setBusy(true);
    try {
      await createWorkflow({ companyId, name: tpl.name.az, description: tpl.description.az, category: tpl.category, status: 'draft', version: 1, fromTemplateId: tpl.id, createdBy: actorUid, ...tpl.seed });
      toast.success('Workflow şablondan yaradıldı (draft)', 'Aktivləşdirmək üçün toggle-a basın');
      setPick(false); invalidate();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }
  async function toggle(wf: WorkflowDefinition) { setBusy(true); try { await toggleWorkflow(wf, actorUid); invalidate(); } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); } }
  async function confirmDelete() { if (!del) return; setBusy(true); try { await deleteWorkflow(del.id); toast.success('Silindi'); setDel(null); invalidate(); } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); } }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Trigger → Şərt → Təsdiq → Əməliyyat. Aktiv workflow-lar sənəd yaradılanda avtomatik işə düşür.</p>
        {canManage && <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPick(true)}><Plus className="h-4 w-4" /> Şablondan</Button>
          <Button size="sm" onClick={() => setBuild(true)}><Plus className="h-4 w-4" /> Sıfırdan qur</Button>
        </div>}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Workflow yoxdur" description="Şablondan və ya sıfırdan workflow yaradın." action={canManage ? <Button size="sm" onClick={() => setBuild(true)}><Plus className="h-4 w-4" /> Sıfırdan qur</Button> : undefined} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((wf) => (
            <Card key={wf.id} className="rounded-card"><CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><WfIcon className="h-5 w-5" /></span>
                <Badge variant={wf.status === 'active' ? 'success' : wf.status === 'draft' ? 'warning' : 'secondary'}>{wf.status}</Badge>
              </div>
              <p className="mt-3 font-semibold">{wf.name}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{wf.description}</p>
              <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                <span className="rounded bg-muted px-1.5 py-0.5">trigger: {wf.trigger.type}</span>
                {wf.trigger.entityType && <span className="rounded bg-muted px-1.5 py-0.5">{wf.trigger.entityType}</span>}
                {(wf.conditions ?? []).length > 0 && <span className="rounded bg-muted px-1.5 py-0.5">{wf.conditions!.length} şərt</span>}
                {wf.approval && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">təsdiq: {wf.approval.mode}</span>}
                {(wf.actions ?? []).length > 0 && <span className="rounded bg-muted px-1.5 py-0.5">{wf.actions.length} əməliyyat</span>}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setTest(wf)}><FlaskConical className="h-3.5 w-3.5" /> Test et</Button>
                {canManage && <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => toggle(wf)}><Power className="h-3.5 w-3.5" /> {wf.status === 'active' ? 'Deaktiv' : 'Aktiv et'}</Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" disabled={busy} onClick={() => setDel(wf)}><Trash2 className="h-4 w-4" /></Button>
                </div>}
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Dialog open={pick} onOpenChange={setPick}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Şablon seç</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {WORKFLOW_TEMPLATES.map((t) => (
              <button key={t.id} disabled={busy} onClick={() => instantiate(t.id)} className="flex w-full items-start gap-3 rounded-card border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary">
                <span className="mt-0.5 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{t.category}</span>
                <span className="min-w-0"><span className="block font-medium">{t.name.az}</span><span className="block text-xs text-muted-foreground">{t.description.az}</span></span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {build && <BuilderDialog companyId={companyId} actorUid={actorUid} onClose={() => setBuild(false)} onSaved={invalidate} />}
      {test && <TestDialog wf={test} onClose={() => setTest(null)} />}
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Workflow-u sil" description={`"${del?.name}" silinsin?`} confirmLabel="Sil" loading={busy} onConfirm={confirmDelete} />
    </div>
  );
}

// ── Sıfırdan qur (form-əsaslı node builder) ──
function BuilderDialog({ companyId, actorUid, onClose, onSaved }: { companyId: string; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<'on_create' | 'on_update' | 'manual'>('on_create');
  const [entityType, setEntityType] = useState('invoices');
  const [conditions, setConditions] = useState<WorkflowCondition[]>([]);
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [useApproval, setUseApproval] = useState(false);
  const [approverRoleId, setApproverRoleId] = useState('chief_accountant');
  const [approvalMode, setApprovalMode] = useState<'single' | 'sequential' | 'parallel'>('single');
  const [timeoutHours, setTimeoutHours] = useState('48');
  const [actions, setActions] = useState<WorkflowAction[]>([]);
  const [saving, setSaving] = useState(false);
  const entityFields = REPORTABLE_ENTITIES.find((e) => e.key === entityType)?.fields ?? [];

  async function save() {
    if (!name.trim()) { toast.error('Ad tələb olunur'); return; }
    setSaving(true);
    try {
      await createWorkflow({
        companyId, name: name.trim(), description: 'Sıfırdan qurulmuş', category: 'general', status: 'draft', version: 1, createdBy: actorUid,
        trigger: { type: triggerType, entityType: triggerType === 'manual' ? null : entityType },
        conditions, conditionLogic: logic,
        approval: useApproval ? { approverRoleId, mode: approvalMode, timeoutHours: Number(timeoutHours) || 48 } : null,
        actions,
      });
      toast.success('Workflow yaradıldı (draft)', 'Aktivləşdirmək üçün toggle-a basın');
      onSaved(); onClose();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Yeni workflow — sıfırdan</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Ad</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Böyük faktura təsdiqi" /></div>

          <div className="rounded-lg border border-border/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trigger</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Növ</Label>
                <Select value={triggerType} onValueChange={(v) => setTriggerType(v as typeof triggerType)}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="on_create">Sənəd yaradılanda</SelectItem><SelectItem value="on_update">Sənəd yenilənəndə</SelectItem><SelectItem value="manual">Əl ilə</SelectItem></SelectContent></Select>
              </div>
              {triggerType !== 'manual' && <div className="space-y-2"><Label>Obyekt</Label>
                <Select value={entityType} onValueChange={setEntityType}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REPORTABLE_ENTITIES.map((e) => <SelectItem key={e.key} value={e.key}>{e.label.az} ({e.key})</SelectItem>)}</SelectContent></Select>
              </div>}
            </div>
          </div>

          <div className="rounded-lg border border-border/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Şərtlər</p>
              <div className="flex items-center gap-2">
                {conditions.length > 1 && <Select value={logic} onValueChange={(v) => setLogic(v as 'AND' | 'OR')}><SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AND">VƏ</SelectItem><SelectItem value="OR">VƏ YA</SelectItem></SelectContent></Select>}
                <Button variant="ghost" size="sm" onClick={() => setConditions((c) => [...c, { field: entityFields[0]?.key ?? 'status', operator: '=', value: '' }])}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            {conditions.length === 0 ? <p className="text-xs text-muted-foreground">Şərt yoxdur — həmişə icra olunur.</p> : conditions.map((c, i) => (
              <div key={i} className="mb-1 flex items-center gap-1">
                <Select value={c.field} onValueChange={(v) => setConditions((arr) => arr.map((x, idx) => idx === i ? { ...x, field: v } : x))}><SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{entityFields.map((f) => <SelectItem key={f.key} value={f.key}>{f.label.az}</SelectItem>)}</SelectContent></Select>
                <Select value={c.operator} onValueChange={(v) => setConditions((arr) => arr.map((x, idx) => idx === i ? { ...x, operator: v as WorkflowCondition['operator'] } : x))}><SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{COND_OPS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                <Input className="h-8 w-24 text-xs" value={String(c.value ?? '')} onChange={(e) => setConditions((arr) => arr.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => setConditions((arr) => arr.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border/60 p-3">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={useApproval} onChange={(e) => setUseApproval(e.target.checked)} /> Təsdiq addımı</label>
            {useApproval && <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Rol</Label>
                <Select value={approverRoleId} onValueChange={setApproverRoleId}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SYSTEM_ROLES.map((r) => <SelectItem key={r.code} value={r.code}>{r.name.az}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>Rejim</Label>
                <Select value={approvalMode} onValueChange={(v) => setApprovalMode(v as typeof approvalMode)}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="single">Tək</SelectItem><SelectItem value="sequential">Ardıcıl</SelectItem><SelectItem value="parallel">Paralel</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>Timeout (saat)</Label><Input type="number" value={timeoutHours} onChange={(e) => setTimeoutHours(e.target.value)} /></div>
            </div>}
          </div>

          <div className="rounded-lg border border-border/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Əməliyyatlar</p>
              <Button variant="ghost" size="sm" onClick={() => setActions((a) => [...a, { type: 'send_notification', config: { titleTemplate: '' }, label: 'Bildiriş' }])}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
            {actions.length === 0 ? <p className="text-xs text-muted-foreground">Əməliyyat yoxdur.</p> : actions.map((a, i) => (
              <div key={i} className="mb-2 flex items-start gap-2 rounded border border-border/50 p-2">
                <Select value={a.type} onValueChange={(v) => setActions((arr) => arr.map((x, idx) => idx === i ? { type: v as WorkflowAction['type'], config: {}, label: v } : x))}><SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="send_notification">Bildiriş</SelectItem><SelectItem value="update_field">Sahə yenilə</SelectItem><SelectItem value="create_task">Tapşırıq yarat</SelectItem></SelectContent></Select>
                <div className="flex-1 space-y-1">
                  {a.type === 'send_notification' && <Input className="h-8 text-xs" placeholder="Başlıq ({{context.customerName}})" value={String(a.config.titleTemplate ?? '')} onChange={(e) => setActions((arr) => arr.map((x, idx) => idx === i ? { ...x, config: { ...x.config, titleTemplate: e.target.value } } : x))} />}
                  {a.type === 'update_field' && <div className="flex gap-1"><Input className="h-8 text-xs" placeholder="sahə (status)" value={String(a.config.targetField ?? '')} onChange={(e) => setActions((arr) => arr.map((x, idx) => idx === i ? { ...x, config: { ...x.config, targetField: e.target.value } } : x))} /><Input className="h-8 text-xs" placeholder="dəyər (approved)" value={String(a.config.newValue ?? '')} onChange={(e) => setActions((arr) => arr.map((x, idx) => idx === i ? { ...x, config: { ...x.config, newValue: e.target.value } } : x))} /></div>}
                  {a.type === 'create_task' && <div className="flex gap-1"><Input className="h-8 text-xs" placeholder="tapşırıq adı" value={String(a.config.title ?? '')} onChange={(e) => setActions((arr) => arr.map((x, idx) => idx === i ? { ...x, config: { ...x.config, title: e.target.value } } : x))} /><Input className="h-8 w-20 text-xs" type="number" placeholder="gün" value={String(a.config.dueInDays ?? '')} onChange={(e) => setActions((arr) => arr.map((x, idx) => idx === i ? { ...x, config: { ...x.config, dueInDays: Number(e.target.value) } } : x))} /></div>}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => setActions((arr) => arr.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Yarat</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Test et (simulate) ──
function TestDialog({ wf, onClose }: { wf: WorkflowDefinition; onClose: () => void }) {
  const fields = REPORTABLE_ENTITIES.find((e) => e.key === wf.trigger.entityType)?.fields ?? [];
  const usedKeys = Array.from(new Set([...(wf.conditions ?? []).map((c) => c.field), ...fields.slice(0, 3).map((f) => f.key)]));
  const [sample, setSample] = useState<Record<string, string>>({});
  const result = simulateWorkflow(wf, sample);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>«{wf.name}» — Test (yan-effektsiz)</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Nümunə sənəd dəyərlərini daxil edin — icra yolu real dəyişiklik olmadan göstərilir (04 §7.3).</p>
          {usedKeys.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {usedKeys.map((k) => (
                <div key={k} className="space-y-1"><Label className="text-xs">{fields.find((f) => f.key === k)?.label.az ?? k}</Label>
                  <Input className="h-8 text-sm" value={sample[k] ?? ''} onChange={(e) => setSample((s) => ({ ...s, [k]: e.target.value }))} /></div>
              ))}
            </div>
          )}
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">İcra yolu → yekun: <span className="text-foreground">{result.finalStatus}</span></p>
            <ol className="space-y-1.5">
              {result.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${s.result === 'success' ? 'bg-success/15 text-success' : s.result === 'failure' ? 'bg-danger/15 text-danger' : s.result === 'pending' ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground'}`}>{i + 1}</span>
                  <span><span className="font-medium">{s.label}</span>{s.detail ? <span className="text-xs text-muted-foreground"> · {s.detail}</span> : null}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Bağla</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
