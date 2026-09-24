'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Plus, StickyNote, Phone, Mail, Users, MessageCircle, GitBranch, RefreshCw, CheckSquare, type LucideIcon,
} from 'lucide-react';
import { listActivities, listOpportunities, logActivity } from '@/lib/firebase/crm';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import { formatDateTime } from '@/lib/utils/format';
import type { CrmActivity, CrmActivityType } from '@/types';
import type { CrmTabProps } from './page';

const ICON: Record<CrmActivityType, LucideIcon> = {
  note: StickyNote, call: Phone, email: Mail, meeting: Users, whatsapp: MessageCircle,
  task: CheckSquare, stage_change: GitBranch, status_change: RefreshCw,
};
const TYPE_LABEL: Record<CrmActivityType, { az: string; en: string }> = {
  note: { az: 'Qeyd', en: 'Note' }, call: { az: 'Zəng', en: 'Call' }, email: { az: 'E-poçt', en: 'Email' },
  meeting: { az: 'Görüş', en: 'Meeting' }, whatsapp: { az: 'WhatsApp', en: 'WhatsApp' }, task: { az: 'Tapşırıq', en: 'Task' },
  stage_change: { az: 'Mərhələ dəyişikliyi', en: 'Stage change' }, status_change: { az: 'Status dəyişikliyi', en: 'Status change' },
};
const ts = (v: unknown) => (v && typeof v === 'object' && 'toMillis' in (v as Record<string, unknown>) ? (v as { toMillis: () => number }).toMillis() : (v && typeof v === 'object' && 'seconds' in (v as Record<string, unknown>) ? (v as { seconds: number }).seconds * 1000 : null));

export function ActivityTab({ companyId, canEdit, actorUid, actorName }: CrmTabProps) {
  const qc = useQueryClient();
  const tt = useTT();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['crmActivities', companyId], queryFn: () => listActivities(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['crmActivities', companyId] });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{tt('Bütün CRM qarşılıqlı əlaqələrinin xronoloji lenti.', 'Chronological feed of all CRM interactions.')}</p>
        {canEdit && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Aktivlik yaz', 'Log activity')}</Button>}
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Aktivlik yoxdur', 'No activity')} description={tt('Zəng, görüş və ya qeyd yazın.', 'Log a call, meeting or note.')} />
      ) : (
        <Card className="rounded-card"><CardContent className="p-0">
          <ul className="divide-y divide-border">
            {(data ?? []).map((a) => {
              const Icon = ICON[a.type] ?? StickyNote;
              const time = ts(a.createdAt);
              return (
                <li key={a.id} className="flex items-start gap-3 p-4">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="text-sm font-medium">{a.subject || tt(TYPE_LABEL[a.type]?.az ?? a.type, TYPE_LABEL[a.type]?.en ?? a.type)}</span>
                      {a.entityLabel && <span className="text-xs text-muted-foreground">· {a.entityLabel}</span>}
                    </div>
                    {a.body && <p className="mt-0.5 text-sm text-muted-foreground">{a.body}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground">{a.ownerName ?? a.createdByName ?? ''}{time ? ` · ${formatDateTime(time)}` : ''}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent></Card>
      )}

      {open && <LogDialog companyId={companyId} actorUid={actorUid} actorName={actorName} onClose={() => setOpen(false)} onSaved={refresh} />}
    </div>
  );
}

function LogDialog({ companyId, actorUid, actorName, onClose, onSaved }: { companyId: string; actorUid: string; actorName: string | null; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [type, setType] = useState<CrmActivityType>('call');
  const [oppId, setOppId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: opps } = useQuery({ queryKey: ['crmOpportunities', companyId], queryFn: () => listOpportunities(companyId) });

  async function save() {
    if (!oppId) { toast.error(tt('İmkan seçin', 'Select an opportunity')); return; }
    const opp = opps?.find((o) => o.id === oppId);
    setBusy(true);
    try {
      await logActivity({ companyId, type, entityType: 'opportunity', entityId: oppId, entityLabel: opp?.title ?? null, subject: subject.trim() || null, body: body.trim() || null, ownerUid: actorUid, ownerName: actorName, createdBy: actorUid, createdByName: actorName });
      toast.success(tt('Aktivlik yazıldı', 'Activity logged'));
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  const types: CrmActivityType[] = ['call', 'email', 'meeting', 'whatsapp', 'note', 'task'];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{tt('Aktivlik yaz', 'Log activity')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Növ', 'Type')}</Label>
              <Select value={type} onValueChange={(v) => setType(v as CrmActivityType)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{types.map((t) => <SelectItem key={t} value={t}>{tt(TYPE_LABEL[t].az, TYPE_LABEL[t].en)}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>{tt('İmkan', 'Opportunity')}</Label>
              <Select value={oppId} onValueChange={setOppId}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
                <SelectContent>{(opps ?? []).map((o) => <SelectItem key={o.id} value={o.id}>{o.opportunityNumber} · {o.title}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="space-y-2"><Label>{tt('Mövzu', 'Subject')}</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Məzmun', 'Details')}</Label><Input value={body} onChange={(e) => setBody(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yaz', 'Log')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
