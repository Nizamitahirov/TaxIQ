'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Trash2, ClipboardList, AlertTriangle } from 'lucide-react';
import { listHseAudits, saveHseAudit, deleteHseAudit } from '@/lib/firebase/hse';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import type { HseAudit, HseAuditFinding } from '@/types';

const ST = { planned: { label: 'Planlaşdırılıb', en: 'Planned', v: 'secondary' as const }, in_progress: { label: 'Davam edir', en: 'In progress', v: 'warning' as const }, completed: { label: 'Tamamlandı', en: 'Completed', v: 'success' as const } };
const SEV = { low: 'Aşağı', medium: 'Orta', high: 'Yüksək' };
const SEV_EN = { low: 'Low', medium: 'Medium', high: 'High' };

export function AuditTab({ companyId, uid, canEdit, canDelete }: { companyId: string; uid: string; canEdit: boolean; canDelete: boolean }) {
  const qc = useQueryClient();
  const tt = useTT();
  const stLabel = (s: HseAudit['status']) => tt(ST[s].label, ST[s].en);
  const sev = (s: HseAuditFinding['severity']) => tt(SEV[s], SEV_EN[s]);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['hseAudits', companyId], queryFn: () => listHseAudits(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['hseAudits', companyId] });

  async function remove(a: HseAudit) { if (!window.confirm(tt('Audit silinsin?', 'Delete audit?'))) return; try { await deleteHseAudit(a.id); refresh(); } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{tt('SƏTƏM auditləri və aşkarlanmış uyğunsuzluqlar (findings).', 'HSE audits and identified non-conformities (findings).')}</p>
        <div className="flex gap-2">
          <ExportButton filename="setem-auditler" rows={data ?? []} columns={[
            { header: tt('Başlıq', 'Title'), value: 'title' }, { header: tt('Tarix', 'Date'), value: 'auditDate' }, { header: tt('Auditor', 'Auditor'), value: 'auditor' },
            { header: tt('Sahə', 'Area'), value: 'area' }, { header: 'Status', value: (a) => stLabel(a.status) }, { header: 'Findings', value: (a) => a.findings.length },
          ]} />
          {canEdit && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni audit', 'New audit')}</Button>}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Audit yoxdur', 'No audits')} description={tt('İlk SƏTƏM auditini əlavə edin.', 'Add the first HSE audit.')} />
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((a) => {
            const openFindings = a.findings.filter((f) => f.status === 'open').length;
            return (
              <Card key={a.id} className="rounded-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><ClipboardList className="h-4 w-4" /></span>
                        <span className="font-semibold">{a.title}</span>
                        <Badge variant={ST[a.status].v}>{stLabel(a.status)}</Badge>
                        {openFindings > 0 && <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" /> {openFindings} {tt('açıq', 'open')}</Badge>}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{a.auditDate} · {a.auditor} · {a.area}</p>
                    </div>
                    {canDelete && <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => remove(a)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                  {a.findings.length > 0 && (
                    <ul className="mt-3 space-y-1 border-t border-border/50 pt-2">
                      {a.findings.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Badge variant={f.severity === 'high' ? 'destructive' : f.severity === 'medium' ? 'warning' : 'secondary'} className="shrink-0">{sev(f.severity)}</Badge>
                          <span className={f.status === 'closed' ? 'text-muted-foreground line-through' : ''}>{f.description}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {open && <AuditDialog companyId={companyId} uid={uid} onClose={() => setOpen(false)} onSaved={refresh} />}
    </div>
  );
}

function AuditDialog({ companyId, uid, onClose, onSaved }: { companyId: string; uid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [title, setTitle] = useState('');
  const [auditDate, setAuditDate] = useState(new Date().toISOString().slice(0, 10));
  const [auditor, setAuditor] = useState('');
  const [area, setArea] = useState('');
  const [status, setStatus] = useState<HseAudit['status']>('planned');
  const [findings, setFindings] = useState<HseAuditFinding[]>([]);
  const [fDesc, setFDesc] = useState('');
  const [fSev, setFSev] = useState<HseAuditFinding['severity']>('medium');
  const [busy, setBusy] = useState(false);

  function addFinding() { if (!fDesc.trim()) return; setFindings((p) => [...p, { description: fDesc.trim(), severity: fSev, status: 'open' }]); setFDesc(''); setFSev('medium'); }

  async function save() {
    if (!title.trim()) { toast.error(tt('Başlıq daxil edin', 'Enter a title')); return; }
    setBusy(true);
    try { await saveHseAudit({ companyId, title: title.trim(), auditDate, auditor, area, status, findings, createdBy: uid }); toast.success(tt('Audit saxlanıldı', 'Audit saved')); onSaved(); onClose(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{tt('SƏTƏM auditi', 'HSE audit')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>{tt('Başlıq', 'Title')}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tt('məs. Rüblük anbar auditi', 'e.g. Quarterly warehouse audit')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Tarix', 'Date')}</Label><Input type="date" value={auditDate} onChange={(e) => setAuditDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as HseAudit['status'])}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="planned">{tt('Planlaşdırılıb', 'Planned')}</SelectItem><SelectItem value="in_progress">{tt('Davam edir', 'In progress')}</SelectItem><SelectItem value="completed">{tt('Tamamlandı', 'Completed')}</SelectItem></SelectContent></Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Auditor', 'Auditor')}</Label><Input value={auditor} onChange={(e) => setAuditor(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Sahə/obyekt', 'Area/object')}</Label><Input value={area} onChange={(e) => setArea(e.target.value)} /></div>
          </div>
          <div className="rounded-lg border border-border p-3">
            <Label className="mb-2 block">{tt('Uyğunsuzluqlar (findings)', 'Non-conformities (findings)')}</Label>
            <div className="flex items-end gap-2">
              <Input value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder={tt('Təsvir', 'Description')} className="flex-1" onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFinding())} />
              <Select value={fSev} onValueChange={(v) => setFSev(v as HseAuditFinding['severity'])}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="low">{tt('Aşağı', 'Low')}</SelectItem><SelectItem value="medium">{tt('Orta', 'Medium')}</SelectItem><SelectItem value="high">{tt('Yüksək', 'High')}</SelectItem></SelectContent></Select>
              <Button type="button" size="icon" onClick={addFinding}><Plus className="h-4 w-4" /></Button>
            </div>
            {findings.length > 0 && <ul className="mt-2 space-y-1">{findings.map((f, i) => (
              <li key={i} className="flex items-center gap-2 text-sm"><Badge variant={f.severity === 'high' ? 'destructive' : f.severity === 'medium' ? 'warning' : 'secondary'}>{tt(SEV[f.severity], SEV_EN[f.severity])}</Badge><span className="flex-1">{f.description}</span><button onClick={() => setFindings((p) => p.filter((_, k) => k !== i))} className="text-danger"><Trash2 className="h-3.5 w-3.5" /></button></li>
            ))}</ul>}
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {tt('Yadda saxla', 'Save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
