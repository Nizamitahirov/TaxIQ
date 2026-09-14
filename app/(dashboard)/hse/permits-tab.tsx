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
import type { HseWorkPermit } from '@/types';

const TYPES: { v: HseWorkPermit['permitType']; label: string; icon: typeof Flame }[] = [
  { v: 'hot_work', label: 'İsti iş', icon: Flame },
  { v: 'height', label: 'Yüksəklikdə iş', icon: Mountain },
  { v: 'confined_space', label: 'Qapalı sahə', icon: Box },
  { v: 'electrical', label: 'Elektrik işləri', icon: Zap },
  { v: 'excavation', label: 'Qazıntı işləri', icon: Shovel },
  { v: 'general', label: 'Ümumi', icon: Wrench },
];
const typeLabel = (v: string) => TYPES.find((t) => t.v === v)?.label ?? v;
const ST: Record<HseWorkPermit['status'], { label: string; v: 'secondary' | 'success' | 'warning' | 'destructive' | 'default' }> = {
  draft: { label: 'Layihə', v: 'secondary' }, approved: { label: 'Təsdiqlənib', v: 'success' },
  active: { label: 'Aktiv', v: 'default' }, closed: { label: 'Bağlanıb', v: 'secondary' }, rejected: { label: 'Rədd edilib', v: 'destructive' },
};

export function PermitsTab({ companyId, uid, canEdit, canApprove }: { companyId: string; uid: string; canEdit: boolean; canApprove: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['hsePermits', companyId], queryFn: () => listHseWorkPermits(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['hsePermits', companyId] });

  async function decide(p: HseWorkPermit, approve: boolean) { try { await decideWorkPermit(p, approve, uid); toast.success(approve ? 'Təsdiqləndi' : 'Rədd edildi'); refresh(); } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } }
  async function setStatus(p: HseWorkPermit, s: HseWorkPermit['status']) { try { await setWorkPermitStatus(p.id, s); refresh(); } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Təhlükəli işlər üçün iş icazələri (isti iş, yüksəklik, qapalı sahə və s.) — təsdiq axını ilə.</p>
        <div className="flex gap-2">
          <ExportButton filename="is-icazeleri" rows={data ?? []} columns={[
            { header: 'Nömrə', value: 'permitNumber' }, { header: 'Növ', value: (p) => typeLabel(p.permitType) }, { header: 'Yer', value: 'location' },
            { header: 'Başlanğıc', value: 'validFrom' }, { header: 'Bitmə', value: 'validTo' }, { header: 'Status', value: (p) => ST[p.status].label },
          ]} />
          {canEdit && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> İcazə yarat</Button>}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="İcazə yoxdur" description="İlk iş icazəsini yaradın." />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nömrə</TableHead><TableHead>Növ</TableHead><TableHead>Yer</TableHead>
              <TableHead>Müddət</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs font-semibold">{p.permitNumber}</TableCell>
                  <TableCell>{typeLabel(p.permitType)}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{p.location}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.validFrom} → {p.validTo}</TableCell>
                  <TableCell><Badge variant={ST[p.status].v}>{ST[p.status].label}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canApprove && p.status === 'draft' && (<>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-success" title="Təsdiqlə" onClick={() => decide(p, true)}><Check className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" title="Rədd et" onClick={() => decide(p, false)}><X className="h-4 w-4" /></Button>
                      </>)}
                      {canApprove && p.status === 'approved' && <Button variant="outline" size="sm" onClick={() => setStatus(p, 'active')}>Aktivləşdir</Button>}
                      {canApprove && p.status === 'active' && <Button variant="outline" size="sm" onClick={() => setStatus(p, 'closed')}>Bağla</Button>}
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
  const [permitType, setPermitType] = useState<HseWorkPermit['permitType']>('hot_work');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [requestedBy, setRequestedBy] = useState('');
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validTo, setValidTo] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!location.trim()) { toast.error('Yer daxil edin'); return; }
    if (validTo < validFrom) { toast.error('Bitmə tarixi başlanğıcdan əvvəl ola bilməz'); return; }
    setBusy(true);
    try {
      const permitNumber = await nextPermitNumber(companyId);
      await createHseWorkPermit({ companyId, permitNumber, permitType, location: location.trim(), description: description || null, requestedBy, validFrom, validTo, uid });
      toast.success('İş icazəsi yaradıldı', permitNumber);
      onSaved(); onClose();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><HardHat className="h-5 w-5 text-primary" /> İş icazəsi</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>İş növü</Label>
            <Select value={permitType} onValueChange={(v) => setPermitType(v as HseWorkPermit['permitType'])}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t.v} value={t.v}><span className="flex items-center gap-2"><t.icon className="h-4 w-4" /> {t.label}</span></SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>Yer / obyekt</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} /></div>
          <div className="space-y-2"><Label>Təsvir (seçimlik)</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="space-y-2"><Label>Tələb edən</Label><Input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Başlanğıc</Label><Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} /></div>
            <div className="space-y-2"><Label>Bitmə</Label><Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Yarat</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
