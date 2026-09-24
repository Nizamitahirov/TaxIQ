'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Check, X, HardHat, Flame, Mountain, Box, Zap, Shovel, Wrench } from 'lucide-react';
import {
  listHseWorkPermits, createHseWorkPermit, nextPermitNumber, decideWorkPermit, setWorkPermitStatus,
} from '@/lib/firebase/hse';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import type { HseWorkPermit } from '@/types';

const TYPES: { v: HseWorkPermit['permitType']; label: string; en: string; icon: typeof Flame }[] = [
  { v: 'hot_work', label: 'İsti iş', en: 'Hot work', icon: Flame },
  { v: 'height', label: 'Yüksəklikdə iş', en: 'Work at height', icon: Mountain },
  { v: 'confined_space', label: 'Qapalı sahə', en: 'Confined space', icon: Box },
  { v: 'electrical', label: 'Elektrik işləri', en: 'Electrical work', icon: Zap },
  { v: 'excavation', label: 'Qazıntı işləri', en: 'Excavation work', icon: Shovel },
  { v: 'general', label: 'Ümumi', en: 'General', icon: Wrench },
];
const ST: Record<HseWorkPermit['status'], { label: string; en: string; v: 'secondary' | 'success' | 'warning' | 'destructive' | 'default' }> = {
  draft: { label: 'Layihə', en: 'Draft', v: 'secondary' }, approved: { label: 'Təsdiqlənib', en: 'Approved', v: 'success' },
  active: { label: 'Aktiv', en: 'Active', v: 'default' }, closed: { label: 'Bağlanıb', en: 'Closed', v: 'secondary' }, rejected: { label: 'Rədd edilib', en: 'Rejected', v: 'destructive' },
};

export function PermitsTab({ companyId, uid, canEdit, canApprove }: { companyId: string; uid: string; canEdit: boolean; canApprove: boolean }) {
  const qc = useQueryClient();
  const tt = useTT();
  const typeLabel = (v: string) => { const t = TYPES.find((x) => x.v === v); return t ? tt(t.label, t.en) : v; };
  const stLabel = (s: HseWorkPermit['status']) => tt(ST[s].label, ST[s].en);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['hsePermits', companyId], queryFn: () => listHseWorkPermits(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['hsePermits', companyId] });

  async function decide(p: HseWorkPermit, approve: boolean) { try { await decideWorkPermit(p, approve, uid); toast.success(approve ? tt('Təsdiqləndi', 'Approved') : tt('Rədd edildi', 'Rejected')); refresh(); } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } }
  async function setStatus(p: HseWorkPermit, s: HseWorkPermit['status']) { try { await setWorkPermitStatus(p.id, s); refresh(); } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{tt('Təhlükəli işlər üçün iş icazələri (isti iş, yüksəklik, qapalı sahə və s.) — təsdiq axını ilə.', 'Work permits for hazardous work (hot work, height, confined space, etc.) — with an approval flow.')}</p>
        <div className="flex gap-2">
          <ExportButton filename="is-icazeleri" rows={data ?? []} columns={[
            { header: tt('Nömrə', 'Number'), value: 'permitNumber' }, { header: tt('Növ', 'Type'), value: (p) => typeLabel(p.permitType) }, { header: tt('Yer', 'Location'), value: 'location' },
            { header: tt('Başlanğıc', 'Start'), value: 'validFrom' }, { header: tt('Bitmə', 'End'), value: 'validTo' }, { header: 'Status', value: (p) => stLabel(p.status) },
          ]} />
          {canEdit && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('İcazə yarat', 'Create permit')}</Button>}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('İcazə yoxdur', 'No permits')} description={tt('İlk iş icazəsini yaradın.', 'Create the first work permit.')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{tt('Nömrə', 'Number')}</TableHead><TableHead>{tt('Növ', 'Type')}</TableHead><TableHead>{tt('Yer', 'Location')}</TableHead>
              <TableHead>{tt('Müddət', 'Period')}</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs font-semibold">{p.permitNumber}</TableCell>
                  <TableCell>{typeLabel(p.permitType)}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{p.location}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.validFrom} → {p.validTo}</TableCell>
                  <TableCell><Badge variant={ST[p.status].v}>{stLabel(p.status)}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canApprove && p.status === 'draft' && (<>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-success" title={tt('Təsdiqlə', 'Approve')} onClick={() => decide(p, true)}><Check className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" title={tt('Rədd et', 'Reject')} onClick={() => decide(p, false)}><X className="h-4 w-4" /></Button>
                      </>)}
                      {canApprove && p.status === 'approved' && <Button variant="outline" size="sm" onClick={() => setStatus(p, 'active')}>{tt('Aktivləşdir', 'Activate')}</Button>}
                      {canApprove && p.status === 'active' && <Button variant="outline" size="sm" onClick={() => setStatus(p, 'closed')}>{tt('Bağla', 'Close')}</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {open && <PermitDialog companyId={companyId} uid={uid} onClose={() => setOpen(false)} onSaved={refresh} />}
    </div>
  );
}

function PermitDialog({ companyId, uid, onClose, onSaved }: { companyId: string; uid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [permitType, setPermitType] = useState<HseWorkPermit['permitType']>('hot_work');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [requestedBy, setRequestedBy] = useState('');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!location.trim()) { toast.error(tt('Yer daxil edin', 'Enter a location')); return; }
    if (validTo < validFrom) { toast.error(tt('Bitmə tarixi başlanğıcdan əvvəl ola bilməz', 'End date cannot be before the start')); return; }
    setBusy(true);
    try {
      const permitNumber = await nextPermitNumber(companyId);
      await createHseWorkPermit({ companyId, permitNumber, permitType, location: location.trim(), description: description || null, requestedBy, validFrom, validTo, uid });
      toast.success(tt('İş icazəsi yaradıldı', 'Work permit created'), permitNumber);
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><HardHat className="h-5 w-5 text-primary" /> {tt('İş icazəsi', 'Work permit')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>{tt('İş növü', 'Work type')}</Label>
            <Select value={permitType} onValueChange={(v) => setPermitType(v as HseWorkPermit['permitType'])}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}><span className="flex items-center gap-2"><t.icon className="h-4 w-4" /> {tt(t.label, t.en)}</span></SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>{tt('Yer / obyekt', 'Location / object')}</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Təsvir (seçimlik)', 'Description (optional)')}</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Tələb edən', 'Requested by')}</Label><Input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Başlanğıc', 'Start')}</Label><Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Bitmə', 'End')}</Label><Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
