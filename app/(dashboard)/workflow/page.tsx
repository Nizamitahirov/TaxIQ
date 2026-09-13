'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Plus, Power, Trash2, Workflow as WfIcon, Inbox, ArrowUpRight, Info,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  listWorkflows, createWorkflow, deleteWorkflow, toggleWorkflow, aggregatePendingApprovals,
} from '@/lib/firebase/workflow';
import { WORKFLOW_TEMPLATES, WORKFLOW_TEMPLATE_MAP } from '@/lib/workflow/templates';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils/format';
import type { WorkflowDefinition } from '@/types';

export default function WorkflowPage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const companyId = active?.companyId;
  const canManage = isSuperAdmin || can('workflow.designer.manage');

  if (!companyId) return <div><PageHeader title="İş axını" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Aktiv şirkət seçin.</CardContent></Card></div>;

  return (
    <div>
      <PageHeader title="İş axını" subtitle={`${active?.company.name} · avtomatlaşdırma və təsdiqlər (Modul 4)`} />
      <Tabs defaultValue="inbox">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="inbox">Təsdiq inbox-u</TabsTrigger>
          <TabsTrigger value="defs">Workflow-lar</TabsTrigger>
        </TabsList>
        <TabsContent value="inbox"><InboxTab companyId={companyId} /></TabsContent>
        <TabsContent value="defs"><DefsTab companyId={companyId} canManage={canManage} actorUid={profile?.uid ?? ''} /></TabsContent>
      </Tabs>
    </div>
  );
}

function InboxTab({ companyId }: { companyId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['pendingApprovals', companyId], queryFn: () => aggregatePendingApprovals(companyId) });

  return (
    <div>
      <div className="mb-4 flex items-start gap-2 rounded-card border border-info/20 bg-info/5 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        Diqqət tələb edən elementlər bütün modullardan birləşdirilir. Avtomatik event-triggered icra (Firestore trigger + Cloud Tasks, 04 §1.4) Cloud Functions deploy-u tələb edir — gələcək faza.
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Təsdiq gözləyən element yoxdur 🟢" description="Bütün fakturalar, əmək haqqı dövrləri və məzuniyyət tələbləri cavablandırılıb." />
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((p) => (
            <Link key={`${p.kind}-${p.id}`} href={p.link}>
              <Card className="rounded-card transition-shadow hover:shadow-soft-lg">
                <CardContent className="flex items-center gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Inbox className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{p.title}</p><p className="truncate text-xs text-muted-foreground">{p.subtitle}</p></div>
                  {p.amount != null && <span className="shrink-0 text-sm font-semibold tnum">{formatCurrency(p.amount, p.currency ?? 'AZN')}</span>}
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function DefsTab({ companyId, canManage, actorUid }: { companyId: string; canManage: boolean; actorUid: string }) {
  const qc = useQueryClient();
  const [pick, setPick] = useState(false);
  const [del, setDel] = useState<WorkflowDefinition | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['workflows', companyId], queryFn: () => listWorkflows(companyId) });

  function invalidate() { qc.invalidateQueries({ queryKey: ['workflows', companyId] }); }

  async function instantiate(templateId: string) {
    const tpl = WORKFLOW_TEMPLATE_MAP[templateId];
    if (!tpl) return;
    setBusy(true);
    try {
      await createWorkflow({
        companyId, name: tpl.name.az, description: tpl.description.az, category: tpl.category,
        status: 'draft', version: 1, fromTemplateId: tpl.id, createdBy: actorUid, ...tpl.seed,
      });
      toast.success('Workflow şablondan yaradıldı (draft)', 'Aktivləşdirmək üçün toggle-a basın');
      setPick(false); invalidate();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }
  async function toggle(wf: WorkflowDefinition) { setBusy(true); try { await toggleWorkflow(wf, actorUid); invalidate(); } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); } }
  async function confirmDelete() { if (!del) return; setBusy(true); try { await deleteWorkflow(del.id); toast.success('Silindi'); setDel(null); invalidate(); } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); } }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Trigger → Şərt → Təsdiq → Əməliyyat (form-əsaslı, şablondan)</p>
        {canManage && <Button size="sm" onClick={() => setPick(true)}><Plus className="h-4 w-4" /> Şablondan yarat</Button>}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Workflow yoxdur" description="Hazır şablondan workflow yaradın." action={canManage ? <Button size="sm" onClick={() => setPick(true)}><Plus className="h-4 w-4" /> Şablondan yarat</Button> : undefined} />
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
                {wf.approval && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-primary">təsdiq: {wf.approval.mode}</span>}
                {(wf.actions ?? []).length > 0 && <span className="rounded bg-muted px-1.5 py-0.5">{wf.actions.length} əməliyyat</span>}
              </div>
              {canManage && (
                <div className="mt-3 flex items-center justify-between">
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => toggle(wf)}><Power className="h-3.5 w-3.5" /> {wf.status === 'active' ? 'Deaktiv et' : 'Aktivləşdir'}</Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" disabled={busy} onClick={() => setDel(wf)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
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

      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title="Workflow-u sil" description={`"${del?.name}" silinsin?`} confirmLabel="Sil" loading={busy} onConfirm={confirmDelete} />
    </div>
  );
}
