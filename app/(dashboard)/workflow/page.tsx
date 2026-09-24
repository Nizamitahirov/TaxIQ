'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Plus, Power, Trash2, Workflow as WfIcon, Inbox, ArrowUpRight, Info,
  FlaskConical, Check, X, History, CheckCircle2, XCircle, Clock, PlayCircle,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
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
  const tt = useTT();
  const companyId = active?.companyId;
  const canManage = isSuperAdmin || can('workflow.designer.manage');

  if (!companyId) return <div><PageHeader title={tt('İş axını', 'Workflow')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('Aktiv şirkət seçin.', 'Select an active company.')}</CardContent></Card></div>;

  return (
    <div>
      <PageHeader title={tt('İş axını', 'Workflow')} subtitle={`${active?.company.name} · ${tt('avtomatlaşdırma və təsdiqlər (Modul 4)', 'automation & approvals (Module 4)')}`} />
      <Tabs defaultValue="tasks">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="tasks">{tt('Tapşırıqlarım', 'My tasks')}</TabsTrigger>
          <TabsTrigger value="inbox">{tt('Təsdiq inbox-u', 'Approval inbox')}</TabsTrigger>
          <TabsTrigger value="defs">{tt('Workflow-lar', 'Workflows')}</TabsTrigger>
          <TabsTrigger value="runs">{tt('İcra tarixçəsi', 'Run history')}</TabsTrigger>
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
  const tt = useTT();
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['approvalTasks', companyId], queryFn: () => listApprovalTasks(companyId) });
  const pending = (data ?? []).filter((t) => t.status === 'pending');

  async function decide(t: ApprovalTask, approve: boolean) {
    setBusyId(t.id);
    try {
      const comment = approve ? null : (window.prompt(tt('Rədd səbəbi (opsional):', 'Rejection reason (optional):')) ?? '');
      await decideApprovalTask(t, approve, actorUid, comment || null);
      toast.success(approve ? tt('Təsdiqləndi', 'Approved') : tt('Rədd edildi', 'Rejected'), tt('Workflow icrası davam etdi', 'Workflow execution continued'));
      qc.invalidateQueries({ queryKey: ['approvalTasks', companyId] });
      qc.invalidateQueries({ queryKey: ['workflowRuns', companyId] });
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusyId(null); }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">{tt('Aktiv workflow-lar tərəfindən yaradılan təsdiq tapşırıqları. Vəzifələrin ayrılması (SoD): öz yaratdığınız sənədi təsdiqləyə bilməzsiniz.', 'Approval tasks created by active workflows. Separation of duties (SoD): you cannot approve a document you created.')}</p>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : pending.length === 0 ? (
        <EmptyState title={tt('Təsdiq tapşırığı yoxdur 🟢', 'No approval tasks 🟢')} description={tt('Aktiv workflow trigger olduqda təsdiq tapşırıqları burada görünəcək.', 'Approval tasks will appear here when an active workflow triggers.')} />
      ) : (
        <div className="space-y-2">
          {pending.map((t) => (
            <Card key={t.id} className="rounded-card"><CardContent className="flex flex-wrap items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Inbox className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{t.title}</p>
                <p className="truncate text-xs text-muted-foreground">{tt('Rol', 'Role')}: {(() => { const r = SYSTEM_ROLES.find((x) => x.code === t.approverRoleId); return r ? tt(r.name.az, r.name.en) : t.approverRoleId; })()} · {t.mode}{t.relatedEntityType ? ` · ${t.relatedEntityType}` : ''}{t.dueAt ? ` · ${tt('son', 'due')}: ${t.dueAt}` : ''}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="text-success" disabled={busyId === t.id} onClick={() => decide(t, true)}>{busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {tt('Təsdiqlə', 'Approve')}</Button>
                <Button variant="ghost" size="sm" className="text-danger" disabled={busyId === t.id} onClick={() => decide(t, false)}><X className="h-4 w-4" /> {tt('Rədd', 'Reject')}</Button>
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
  const tt = useTT();
  const { data, isLoading } = useQuery({ queryKey: ['pendingApprovals', companyId], queryFn: () => aggregatePendingApprovals(companyId) });
  return (
    <div>
      <div className="mb-4 flex items-start gap-2 rounded-card border border-info/20 bg-info/5 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        {tt('Diqqət tələb edən elementlər bütün modullardan birləşdirilir (məzuniyyət, əmək haqqı, faktura/kreditor draft-ları).', 'Items needing attention are aggregated from all modules (leave, payroll, invoice/bill drafts).')}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Təsdiq gözləyən element yoxdur 🟢', 'No items awaiting approval 🟢')} />
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
  const tt = useTT();
  const { data, isLoading } = useQuery({ queryKey: ['workflowRuns', companyId], queryFn: () => listWorkflowRuns(companyId) });
  const [open, setOpen] = useState<WorkflowRun | null>(null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tt('Bütün workflow icraları tam tarixçə ilə (04 §8).', 'All workflow runs with full history (04 §8).')}</p>
        <ExportButton filename="workflow-icralari" rows={data ?? []} columns={[
          { header: 'Workflow', value: 'workflowName' }, { header: 'Status', value: 'status' },
          { header: 'Trigger', value: (r) => r.triggeredBy.type }, { header: tt('Obyekt', 'Object'), value: (r) => r.triggeredBy.entityType ?? '' },
          { header: tt('Addım sayı', 'Step count'), value: (r) => r.history.length }, { header: tt('Başlanğıc', 'Start'), value: (r) => { const t = ms(r.startedAt); return t ? formatDateTime(t) : ''; } },
        ]} />
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('İcra tarixçəsi boşdur', 'Run history is empty')} description={tt('Aktiv workflow trigger olduqda icralar burada görünəcək.', 'Runs will appear here when an active workflow triggers.')} />
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
          <DialogHeader><DialogTitle>{open?.workflowName} — {tt('icra timeline', 'run timeline')}</DialogTitle></DialogHeader>
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
  const tt = useTT();
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
      toast.success(tt('Workflow şablondan yaradıldı (draft)', 'Workflow created from template (draft)'), tt('Aktivləşdirmək üçün toggle-a basın', 'Toggle to activate'));
      setPick(false); invalidate();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }
  async function toggle(wf: WorkflowDefinition) { setBusy(true); try { await toggleWorkflow(wf, actorUid); invalidate(); } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); } }
  async function confirmDelete() { if (!del) return; setBusy(true); try { await deleteWorkflow(del.id); toast.success(tt('Silindi', 'Deleted')); setDel(null); invalidate(); } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); } }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{tt('Trigger → Şərt → Təsdiq → Əməliyyat. Aktiv workflow-lar sənəd yaradılanda avtomatik işə düşür.', 'Trigger → Condition → Approval → Action. Active workflows run automatically when a document is created.')}</p>
        {canManage && <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setPick(true)}><Plus className="h-4 w-4" /> {tt('Şablondan', 'From template')}</Button>
          <Button size="sm" onClick={() => setBuild(true)}><Plus className="h-4 w-4" /> {tt('Sıfırdan qur', 'Build from scratch')}</Button>
        </div>}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Workflow yoxdur', 'No workflows')} description={tt('Şablondan və ya sıfırdan workflow yaradın.', 'Create a workflow from a template or from scratch.')} action={canManage ? <Button size="sm" onClick={() => setBuild(true)}><Plus className="h-4 w-4" /> {tt('Sıfırdan qur', 'Build from scratch')}</Button> : undefined} />
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
                {(wf.conditions ?? []).length > 0 && <span className="rounded bg-muted px-1.5 py-0.5">{wf.conditions!.length} {tt('şərt', 'cond.')}</span>}
                {wf.approval && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">{tt('təsdiq', 'approval')}: {wf.approval.mode}</span>}
                {(wf.actions ?? []).length > 0 && <span className="rounded bg-muted px-1.5 py-0.5">{wf.actions.length} {tt('əməliyyat', 'actions')}</span>}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setTest(wf)}><FlaskConical className="h-3.5 w-3.5" /> {tt('Test et', 'Test')}</Button>
                {canManage && <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => toggle(wf)}><Power className="h-3.5 w-3.5" /> {wf.status === 'active' ? tt('Deaktiv', 'Deactivate') : tt('Aktiv et', 'Activate')}</Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" disabled={busy} onClick={() => setDel(wf)}><Trash2 className="h-4 w-4" /></Button>
                </div>}
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}

      <Dialog open={pick} onOpenChange={setPick}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{tt('Şablon seç', 'Choose template')}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {WORKFLOW_TEMPLATES.map((t) => (
              <button key={t.id} disabled={busy} onClick={() => instantiate(t.id)} className="flex w-full items-start gap-3 rounded-card border border-border p-3 text-left transition-colors hover:border-primary/40 hover:bg-secondary">
                <span className="mt-0.5 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{t.category}</span>
                <span className="min-w-0"><span className="block font-medium">{tt(t.name.az, t.name.en)}</span><span className="block text-xs text-muted-foreground">{tt(t.description.az, t.description.en)}</span></span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {build && <BuilderDialog companyId={companyId} actorUid={actorUid} onClose={() => setBuild(false)} onSaved={invalidate} />}
      {test && <TestDialog wf={test} onClose={() => setTest(null)} />}
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={tt('Workflow-u sil', 'Delete workflow')} description={`"${del?.name}" ${tt('silinsin?', 'delete?')}`} confirmLabel={tt('Sil', 'Delete')} loading={busy} onConfirm={confirmDelete} />
    </div>
  );
}

// ── Sıfırdan qur (form-əsaslı node builder) ──
function BuilderDialog({ companyId, actorUid, onClose, onSaved }: { companyId: string; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
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
    if (!name.trim()) { toast.error(tt('Ad tələb olunur', 'Name is required')); return; }
    setSaving(true);
    try {
      await createWorkflow({
        companyId, name: name.trim(), description: 'Sıfırdan qurulmuş', category: 'general', status: 'draft', version: 1, createdBy: actorUid,
        trigger: { type: triggerType, entityType: triggerType === 'manual' ? null : entityType },
        conditions, conditionLogic: logic,
        approval: useApproval ? { approverRoleId, mode: approvalMode, timeoutHours: Number(timeoutHours) || 48 } : null,
        actions,
      });
      toast.success(tt('Workflow yaradıldı (draft)', 'Workflow created (draft)'), tt('Aktivləşdirmək üçün toggle-a basın', 'Toggle to activate'));
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{tt('Yeni workflow — sıfırdan', 'New workflow — from scratch')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>{tt('Ad', 'Name')}</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={tt('Böyük faktura təsdiqi', 'Large invoice approval')} /></div>

          <div className="rounded-lg border border-border/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Trigger</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{tt('Növ', 'Type')}</Label>
                <Select value={triggerType} onValueChange={(v) => setTriggerType(v as typeof triggerType)}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="on_create">{tt('Sənəd yaradılanda', 'On document create')}</SelectItem><SelectItem value="on_update">{tt('Sənəd yenilənəndə', 'On document update')}</SelectItem><SelectItem value="manual">{tt('Əl ilə', 'Manual')}</SelectItem></SelectContent></Select>
              </div>
              {triggerType !== 'manual' && <div className="space-y-2"><Label>{tt('Obyekt', 'Object')}</Label>
                <Select value={entityType} onValueChange={setEntityType}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REPORTABLE_ENTITIES.map((e) => <SelectItem key={e.key} value={e.key}>{tt(e.label.az, e.label.en)} ({e.key})</SelectItem>)}</SelectContent></Select>
              </div>}
            </div>
          </div>

          <div className="rounded-lg border border-border/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tt('Şərtlər', 'Conditions')}</p>
              <div className="flex items-center gap-2">
                {conditions.length > 1 && <Select value={logic} onValueChange={(v) => setLogic(v as 'AND' | 'OR')}><SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AND">{tt('VƏ', 'AND')}</SelectItem><SelectItem value="OR">{tt('VƏ YA', 'OR')}</SelectItem></SelectContent></Select>}
                <Button variant="ghost" size="sm" onClick={() => setConditions((c) => [...c, { field: entityFields[0]?.key ?? 'status', operator: '=', value: '' }])}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
            {conditions.length === 0 ? <p className="text-xs text-muted-foreground">{tt('Şərt yoxdur — həmişə icra olunur.', 'No conditions — always runs.')}</p> : conditions.map((c, i) => (
              <div key={i} className="mb-1 flex items-center gap-1">
                <Select value={c.field} onValueChange={(v) => setConditions((arr) => arr.map((x, idx) => idx === i ? { ...x, field: v } : x))}><SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{entityFields.map((f) => <SelectItem key={f.key} value={f.key}>{tt(f.label.az, f.label.en)}</SelectItem>)}</SelectContent></Select>
                <Select value={c.operator} onValueChange={(v) => setConditions((arr) => arr.map((x, idx) => idx === i ? { ...x, operator: v as WorkflowCondition['operator'] } : x))}><SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{COND_OPS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                <Input className="h-8 w-24 text-xs" value={String(c.value ?? '')} onChange={(e) => setConditions((arr) => arr.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => setConditions((arr) => arr.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border/60 p-3">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={useApproval} onChange={(e) => setUseApproval(e.target.checked)} /> {tt('Təsdiq addımı', 'Approval step')}</label>
            {useApproval && <div className="mt-3 grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>{tt('Rol', 'Role')}</Label>
                <Select value={approverRoleId} onValueChange={setApproverRoleId}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SYSTEM_ROLES.map((r) => <SelectItem key={r.code} value={r.code}>{tt(r.name.az, r.name.en)}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>{tt('Rejim', 'Mode')}</Label>
                <Select value={approvalMode} onValueChange={(v) => setApprovalMode(v as typeof approvalMode)}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="single">{tt('Tək', 'Single')}</SelectItem><SelectItem value="sequential">{tt('Ardıcıl', 'Sequential')}</SelectItem><SelectItem value="parallel">{tt('Paralel', 'Parallel')}</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>{tt('Timeout (saat)', 'Timeout (hours)')}</Label><Input type="number" value={timeoutHours} onChange={(e) => setTimeoutHours(e.target.value)} /></div>
            </div>}
          </div>

          <div className="rounded-lg border border-border/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tt('Əməliyyatlar', 'Actions')}</p>
              <Button variant="ghost" size="sm" onClick={() => setActions((a) => [...a, { type: 'send_notification', config: { titleTemplate: '' }, label: 'Bildiriş' }])}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
            {actions.length === 0 ? <p className="text-xs text-muted-foreground">{tt('Əməliyyat yoxdur.', 'No actions.')}</p> : actions.map((a, i) => (
              <div key={i} className="mb-2 flex items-start gap-2 rounded border border-border/50 p-2">
                <Select value={a.type} onValueChange={(v) => setActions((arr) => arr.map((x, idx) => idx === i ? { type: v as WorkflowAction['type'], config: {}, label: v } : x))}><SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="send_notification">{tt('Bildiriş', 'Notification')}</SelectItem><SelectItem value="update_field">{tt('Sahə yenilə', 'Update field')}</SelectItem><SelectItem value="create_task">{tt('Tapşırıq yarat', 'Create task')}</SelectItem></SelectContent></Select>
                <div className="flex-1 space-y-1">
                  {a.type === 'send_notification' && <Input className="h-8 text-xs" placeholder={tt('Başlıq ({{context.customerName}})', 'Title ({{context.customerName}})')} value={String(a.config.titleTemplate ?? '')} onChange={(e) => setActions((arr) => arr.map((x, idx) => idx === i ? { ...x, config: { ...x.config, titleTemplate: e.target.value } } : x))} />}
                  {a.type === 'update_field' && <div className="flex gap-1"><Input className="h-8 text-xs" placeholder={tt('sahə (status)', 'field (status)')} value={String(a.config.targetField ?? '')} onChange={(e) => setActions((arr) => arr.map((x, idx) => idx === i ? { ...x, config: { ...x.config, targetField: e.target.value } } : x))} /><Input className="h-8 text-xs" placeholder={tt('dəyər (approved)', 'value (approved)')} value={String(a.config.newValue ?? '')} onChange={(e) => setActions((arr) => arr.map((x, idx) => idx === i ? { ...x, config: { ...x.config, newValue: e.target.value } } : x))} /></div>}
                  {a.type === 'create_task' && <div className="flex gap-1"><Input className="h-8 text-xs" placeholder={tt('tapşırıq adı', 'task name')} value={String(a.config.title ?? '')} onChange={(e) => setActions((arr) => arr.map((x, idx) => idx === i ? { ...x, config: { ...x.config, title: e.target.value } } : x))} /><Input className="h-8 w-20 text-xs" type="number" placeholder={tt('gün', 'days')} value={String(a.config.dueInDays ?? '')} onChange={(e) => setActions((arr) => arr.map((x, idx) => idx === i ? { ...x, config: { ...x.config, dueInDays: Number(e.target.value) } } : x))} /></div>}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => setActions((arr) => arr.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Test et (simulate) ──
function TestDialog({ wf, onClose }: { wf: WorkflowDefinition; onClose: () => void }) {
  const tt = useTT();
  const fields = REPORTABLE_ENTITIES.find((e) => e.key === wf.trigger.entityType)?.fields ?? [];
  const usedKeys = Array.from(new Set([...(wf.conditions ?? []).map((c) => c.field), ...fields.slice(0, 3).map((f) => f.key)]));
  const [sample, setSample] = useState<Record<string, string>>({});
  const result = simulateWorkflow(wf, sample);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>«{wf.name}» — {tt('Test (yan-effektsiz)', 'Test (no side effects)')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{tt('Nümunə sənəd dəyərlərini daxil edin — icra yolu real dəyişiklik olmadan göstərilir (04 §7.3).', 'Enter sample document values — the execution path is shown without real changes (04 §7.3).')}</p>
          {usedKeys.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {usedKeys.map((k) => (
                <div key={k} className="space-y-1"><Label className="text-xs">{(() => { const f = fields.find((x) => x.key === k); return f ? tt(f.label.az, f.label.en) : k; })()}</Label>
                  <Input className="h-8 text-sm" value={sample[k] ?? ''} onChange={(e) => setSample((s) => ({ ...s, [k]: e.target.value }))} /></div>
              ))}
            </div>
          )}
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tt('İcra yolu → yekun:', 'Execution path → result:')} <span className="text-foreground">{result.finalStatus}</span></p>
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
        <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Bağla', 'Close')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
