'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Check, X, Sparkles } from 'lucide-react';
import {
  listLeaveRequests, listLeaveTypes, seedLeaveTypes, createLeaveRequest, decideLeaveRequest, listEmployees,
} from '@/lib/firebase/hr';
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
import type { LeaveRequest } from '@/types';

interface Props { companyId: string; canCreate: boolean; actorUid: string; canApprove: boolean }

function daysBetween(a: string, b: string): number {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1);
}

export function LeaveTab({ companyId, canCreate, actorUid, canApprove }: Props) {
  const qc = useQueryClient();
  const tt = useTT();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['leaveRequests', companyId], queryFn: () => listLeaveRequests(companyId) });
  const { data: types } = useQuery({ queryKey: ['leaveTypes', companyId], queryFn: () => listLeaveTypes(companyId) });

  async function seed() { await seedLeaveTypes(companyId); toast.success(tt('Məzuniyyət növləri quruldu', 'Leave types set up')); qc.invalidateQueries({ queryKey: ['leaveTypes', companyId] }); }
  async function decide(req: LeaveRequest, approve: boolean) {
    setBusyId(req.id);
    try { await decideLeaveRequest(req, approve, actorUid); toast.success(approve ? tt('Təsdiqləndi', 'Approved') : tt('Rədd edildi', 'Rejected')); qc.invalidateQueries({ queryKey: ['leaveRequests', companyId] }); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusyId(null); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tt('Əmək Məcəlləsi minimumlarına uyğun növlər (10 §4)', 'Leave types compliant with Labor Code minimums (10 §4)')}</p>
        <div className="flex gap-2">
          <ExportButton filename="mezuniyyet-telebleri" rows={data ?? []} columns={[
            { header: tt('İşçi', 'Employee'), value: 'employeeName' }, { header: tt('Növ', 'Type'), value: 'leaveTypeName' },
            { header: tt('Başlanğıc', 'Start'), value: 'startDate' }, { header: tt('Son', 'End'), value: 'endDate' },
            { header: tt('Gün', 'Days'), value: 'totalDays' }, { header: 'Status', value: 'status' },
          ]} />
          {(types ?? []).length === 0 && <Button size="sm" variant="outline" onClick={seed}><Sparkles className="h-4 w-4" /> {tt('Növləri qur', 'Set up types')}</Button>}
          {canCreate && <Button size="sm" onClick={() => setOpen(true)} disabled={!types?.length}><Plus className="h-4 w-4" /> {tt('Məzuniyyət tələbi', 'Leave request')}</Button>}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Məzuniyyət tələbi yoxdur', 'No leave requests')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{tt('İşçi', 'Employee')}</TableHead><TableHead>{tt('Növ', 'Type')}</TableHead><TableHead>{tt('Başlanğıc', 'Start')}</TableHead><TableHead>{tt('Son', 'End')}</TableHead><TableHead>{tt('Gün', 'Days')}</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.employeeName}</TableCell>
                  <TableCell>{r.leaveTypeName}</TableCell>
                  <TableCell className="text-muted-foreground">{r.startDate}</TableCell>
                  <TableCell className="text-muted-foreground">{r.endDate}</TableCell>
                  <TableCell>{r.totalDays}</TableCell>
                  <TableCell><Badge variant={r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'destructive' : 'warning'}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {canApprove && r.status === 'pending' && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-success" disabled={busyId === r.id} onClick={() => decide(r, true)}><Check className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" disabled={busyId === r.id} onClick={() => decide(r, false)}><X className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {canCreate && <RequestDialog open={open} onOpenChange={setOpen} companyId={companyId} actorUid={actorUid} onSaved={() => qc.invalidateQueries({ queryKey: ['leaveRequests', companyId] })} />}
    </div>
  );
}

function RequestDialog({ open, onOpenChange, companyId, actorUid, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; onSaved: () => void }) {
  const tt = useTT();
  const [employeeId, setEmployeeId] = useState(''); const [leaveTypeId, setLeaveTypeId] = useState('');
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10)); const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const { data: employees } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId), enabled: open });
  const { data: types } = useQuery({ queryKey: ['leaveTypes', companyId], queryFn: () => listLeaveTypes(companyId), enabled: open });

  async function save() {
    const emp = employees?.find((e) => e.id === employeeId); const t = types?.find((x) => x.id === leaveTypeId);
    if (!emp || !t) { toast.error(tt('İşçi və növ seçin', 'Select an employee and type')); return; }
    setSaving(true);
    try {
      await createLeaveRequest({ companyId, employeeId, employeeName: `${emp.firstName} ${emp.lastName}`, leaveTypeId, leaveTypeName: t.name.az, startDate: start, endDate: end, totalDays: daysBetween(start, end), reason: null, createdBy: actorUid });
      toast.success(tt('Tələb yaradıldı', 'Request created')); setEmployeeId(''); setLeaveTypeId(''); onSaved(); onOpenChange(false);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tt('Məzuniyyət tələbi', 'Leave request')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>{tt('İşçi', 'Employee')}</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
              <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>{tt('Növ', 'Type')}</Label>
            <Select value={leaveTypeId} onValueChange={setLeaveTypeId}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
              <SelectContent>{(types ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{tt(t.name.az, t.name.en)}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Başlanğıc', 'Start')}</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Son', 'End')}</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <p className="text-xs text-muted-foreground">{tt('Gün sayı', 'Number of days')}: {daysBetween(start, end)}</p>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
