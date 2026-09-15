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
import { useTT } from '@/lib/i18n/tt';
import type { TimePermission, TimePermissionType } from '@/types';

interface Props { companyId: string; canCreate: boolean; actorUid: string; canApprove: boolean }

const TYPE_LABEL: Record<TimePermissionType, string> = { personal: 'Şəxsi', medical: 'Tibbi', official: 'Xidməti', other: 'Digər' };
const TYPE_LABEL_EN: Record<TimePermissionType, string> = { personal: 'Personal', medical: 'Medical', official: 'Official', other: 'Other' };
const hoursBetween = (a: string, b: string) => {
  const [h1, m1] = a.split(':').map(Number); const [h2, m2] = b.split(':').map(Number);
  return Math.max(0, Math.round(((h2 * 60 + m2) - (h1 * 60 + m1)) / 6) / 10);
};

export function PermissionsTab({ companyId, canCreate, actorUid, canApprove }: Props) {
  const qc = useQueryClient();
  const tt = useTT();
  const typeLabel = (t: TimePermissionType) => tt(TYPE_LABEL[t], TYPE_LABEL_EN[t]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['timePermissions', companyId], queryFn: () => listTimePermissions(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['timePermissions', companyId] });

  async function decide(p: TimePermission, approve: boolean) {
    setBusyId(p.id);
    try { await decideTimePermission(p, approve, actorUid); toast.success(approve ? tt('Təsdiqləndi', 'Approved') : tt('Rədd edildi', 'Rejected')); refresh(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusyId(null); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tt('Saatlıq icazələr (gün ərzində qismən iş vaxtından kənar)', 'Hourly permissions (partial time off during the day)')}</p>
        <div className="flex items-center gap-2">
          <ExportButton filename="saatliq-icazeler" rows={data ?? []} columns={[
            { header: tt('İşçi', 'Employee'), value: 'employeeName' }, { header: tt('Tarix', 'Date'), value: 'date' },
            { header: tt('Başlanğıc', 'Start'), value: 'startTime' }, { header: tt('Son', 'End'), value: 'endTime' }, { header: tt('Saat', 'Hours'), value: 'hours' },
            { header: tt('Növ', 'Type'), value: (p) => typeLabel(p.type) }, { header: tt('Ödənişli', 'Paid'), value: (p) => (p.paid ? tt('Bəli', 'Yes') : tt('Xeyr', 'No')) }, { header: 'Status', value: 'status' },
          ]} />
          {canCreate && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni icazə', 'New permission')}</Button>}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Saatlıq icazə yoxdur', 'No hourly permissions')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{tt('İşçi', 'Employee')}</TableHead><TableHead>{tt('Tarix', 'Date')}</TableHead><TableHead>{tt('Vaxt', 'Time')}</TableHead><TableHead className="text-right">{tt('Saat', 'Hours')}</TableHead><TableHead>{tt('Növ', 'Type')}</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.employeeName}</TableCell>
                  <TableCell className="text-muted-foreground">{p.date}</TableCell>
                  <TableCell className="tnum">{p.startTime}–{p.endTime}</TableCell>
                  <TableCell className="text-right tnum">{p.hours}</TableCell>
                  <TableCell>{typeLabel(p.type)}{!p.paid && <span className="ml-1 text-xs text-muted-foreground">{tt('(ödənişsiz)', '(unpaid)')}</span>}</TableCell>
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
  const tt = useTT();
  const [employeeId, setEmployeeId] = useState(''); const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [start, setStart] = useState('09:00'); const [end, setEnd] = useState('11:00'); const [type, setType] = useState<TimePermissionType>('personal');
  const [paid, setPaid] = useState(true); const [reason, setReason] = useState(''); const [saving, setSaving] = useState(false);
  const { data: employees } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId), enabled: open });
  const hours = hoursBetween(start, end);

  async function save() {
    const emp = employees?.find((e) => e.id === employeeId);
    if (!emp) { toast.error(tt('İşçi seçin', 'Select an employee')); return; }
    if (hours <= 0) { toast.error(tt('Bitmə vaxtı başlanğıcdan sonra olmalıdır', 'End time must be after start time')); return; }
    setSaving(true);
    try {
      await createTimePermission({ companyId, employeeId, employeeName: `${emp.firstName} ${emp.lastName}`, date, startTime: start, endTime: end, hours, type, paid, reason: reason.trim() || null, createdBy: actorUid });
      toast.success(tt('İcazə yaradıldı', 'Permission created')); setReason(''); onSaved(); onOpenChange(false);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tt('Saatlıq icazə', 'Hourly permission')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>{tt('İşçi', 'Employee')}</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
              <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>{tt('Tarix', 'Date')}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Başlanğıc', 'Start')}</Label><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Son', 'End')}</Label><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Növ', 'Type')}</Label>
              <Select value={type} onValueChange={(v) => setType(v as TimePermissionType)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{tt(v, TYPE_LABEL_EN[k as TimePermissionType])}</SelectItem>)}</SelectContent></Select>
            </div>
            <label className="mt-7 flex items-center gap-2 text-sm"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> {tt('Ödənişli', 'Paid')}</label>
          </div>
          <div className="space-y-2"><Label>{tt('Səbəb', 'Reason')}</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <p className="text-xs text-muted-foreground">{tt('Müddət', 'Duration')}: {hours} {tt('saat', 'hours')}</p>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
