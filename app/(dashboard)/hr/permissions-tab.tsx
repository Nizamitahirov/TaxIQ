'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Check, X } from 'lucide-react';
import { listTimePermissions, createTimePermission, decideTimePermission, listEmployees } from '@/lib/firebase/hr';
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
import type { TimePermission, TimePermissionType } from '@/types';

interface Props { companyId: string; canCreate: boolean; actorUid: string; canApprove: boolean }

const TYPE_LABEL: Record<TimePermissionType, string> = { personal: 'Şəxsi', medical: 'Tibbi', official: 'Xidməti', other: 'Digər' };
const hoursBetween = (a: string, b: string) => {
  const [h1, m1] = a.split(':').map(Number); const [h2, m2] = b.split(':').map(Number);
  return Math.max(0, Math.round(((h2 * 60 + m2) - (h1 * 60 + m1)) / 6) / 10);
};

export function PermissionsTab({ companyId, canCreate, actorUid, canApprove }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['timePermissions', companyId], queryFn: () => listTimePermissions(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['timePermissions', companyId] });

  async function decide(p: TimePermission, approve: boolean) {
    setBusyId(p.id);
    try { await decideTimePermission(p, approve, actorUid); toast.success(approve ? 'Təsdiqləndi' : 'Rədd edildi'); refresh(); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusyId(null); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Saatlıq icazələr (gün ərzində qismən iş vaxtından kənar)</p>
        <div className="flex items-center gap-2">
          <ExportButton filename="saatliq-icazeler" rows={data ?? []} columns={[
            { header: 'İşçi', value: 'employeeName' }, { header: 'Tarix', value: 'date' },
            { header: 'Başlanğıc', value: 'startTime' }, { header: 'Son', value: 'endTime' }, { header: 'Saat', value: 'hours' },
            { header: 'Növ', value: (p) => TYPE_LABEL[p.type] }, { header: 'Ödənişli', value: (p) => (p.paid ? 'Bəli' : 'Xeyr') }, { header: 'Status', value: 'status' },
          ]} />
          {canCreate && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Yeni icazə</Button>}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Saatlıq icazə yoxdur" />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>İşçi</TableHead><TableHead>Tarix</TableHead><TableHead>Vaxt</TableHead><TableHead className="text-right">Saat</TableHead><TableHead>Növ</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.employeeName}</TableCell>
                  <TableCell className="text-muted-foreground">{p.date}</TableCell>
                  <TableCell className="tnum">{p.startTime}–{p.endTime}</TableCell>
                  <TableCell className="text-right tnum">{p.hours}</TableCell>
                  <TableCell>{TYPE_LABEL[p.type]}{!p.paid && <span className="ml-1 text-xs text-muted-foreground">(ödənişsiz)</span>}</TableCell>
                  <TableCell><Badge variant={p.status === 'approved' ? 'success' : p.status === 'rejected' ? 'destructive' : 'warning'}>{p.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {canApprove && p.status === 'pending' && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-success" disabled={busyId === p.id} onClick={() => decide(p, true)}><Check className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" disabled={busyId === p.id} onClick={() => decide(p, false)}><X className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {canCreate && <PermDialog open={open} onOpenChange={setOpen} companyId={companyId} actorUid={actorUid} onSaved={refresh} />}
    </div>
  );
}

function PermDialog({ open, onOpenChange, companyId, actorUid, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; onSaved: () => void }) {
  const [employeeId, setEmployeeId] = useState(''); const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState('09:00'); const [end, setEnd] = useState('11:00'); const [type, setType] = useState<TimePermissionType>('personal');
  const [paid, setPaid] = useState(true); const [reason, setReason] = useState(''); const [saving, setSaving] = useState(false);
  const { data: employees } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId), enabled: open });
  const hours = hoursBetween(start, end);

  async function save() {
    const emp = employees?.find((e) => e.id === employeeId);
    if (!emp) { toast.error('İşçi seçin'); return; }
    if (hours <= 0) { toast.error('Bitmə vaxtı başlanğıcdan sonra olmalıdır'); return; }
    setSaving(true);
    try {
      await createTimePermission({ companyId, employeeId, employeeName: `${emp.firstName} ${emp.lastName}`, date, startTime: start, endTime: end, hours, type, paid, reason: reason.trim() || null, createdBy: actorUid });
      toast.success('İcazə yaradıldı'); setReason(''); onSaved(); onOpenChange(false);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Saatlıq icazə</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>İşçi</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
              <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Tarix</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Başlanğıc</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-2"><Label>Son</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Növ</Label>
              <Select value={type} onValueChange={(v) => setType(v as TimePermissionType)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
            </div>
            <label className="mt-7 flex items-center gap-2 text-sm"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Ödənişli</label>
          </div>
          <div className="space-y-2"><Label>Səbəb</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">Müddət: {hours} saat</p>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Yarat</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
