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
import type { LeaveRequest } from '@/types';

interface Props { companyId: string; canCreate: boolean; actorUid: string; canApprove: boolean }

function daysBetween(a: string, b: string): number {
  return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1);
}

export function LeaveTab({ companyId, canCreate, actorUid, canApprove }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['leaveRequests', companyId], queryFn: () => listLeaveRequests(companyId) });
  const { data: types } = useQuery({ queryKey: ['leaveTypes', companyId], queryFn: () => listLeaveTypes(companyId) });

  async function seed() { await seedLeaveTypes(companyId); toast.success('Məzuniyyət növləri quruldu'); qc.invalidateQueries({ queryKey: ['leaveTypes', companyId] }); }
  async function decide(req: LeaveRequest, approve: boolean) {
    setBusyId(req.id);
    try { await decideLeaveRequest(req, approve, actorUid); toast.success(approve ? 'Təsdiqləndi' : 'Rədd edildi'); qc.invalidateQueries({ queryKey: ['leaveRequests', companyId] }); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusyId(null); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Əmək Məcəlləsi minimumlarına uyğun növlər (10 §4)</p>
        <div className="flex gap-2">
          <ExportButton filename="mezuniyyet-telebleri" rows={data ?? []} columns={[
            { header: 'İşçi', value: 'employeeName' }, { header: 'Növ', value: 'leaveTypeName' },
            { header: 'Başlanğıc', value: 'startDate' }, { header: 'Son', value: 'endDate' },
            { header: 'Gün', value: 'totalDays' }, { header: 'Status', value: 'status' },
          ]} />
          {(types ?? []).length === 0 && <Button size="sm" variant="outline" onClick={seed}><Sparkles className="h-4 w-4" /> Növləri qur</Button>}
          {canCreate && <Button size="sm" onClick={() => setOpen(true)} disabled={!types?.length}><Plus className="h-4 w-4" /> Məzuniyyət tələbi</Button>}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Məzuniyyət tələbi yoxdur" />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>İşçi</TableHead><TableHead>Növ</TableHead><TableHead>Başlanğıc</TableHead><TableHead>Son</TableHead><TableHead>Gün</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
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
  const [employeeId, setEmployeeId] = useState(''); const [leaveTypeId, setLeaveTypeId] = useState('');
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10)); const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const { data: employees } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId), enabled: open });
  const { data: types } = useQuery({ queryKey: ['leaveTypes', companyId], queryFn: () => listLeaveTypes(companyId), enabled: open });

  async function save() {
    const emp = employees?.find((e) => e.id === employeeId); const t = types?.find((x) => x.id === leaveTypeId);
    if (!emp || !t) { toast.error('İşçi və növ seçin'); return; }
    setSaving(true);
    try {
      await createLeaveRequest({ companyId, employeeId, employeeName: `${emp.firstName} ${emp.lastName}`, leaveTypeId, leaveTypeName: t.name.az, startDate: start, endDate: end, totalDays: daysBetween(start, end), reason: null, createdBy: actorUid });
      toast.success('Tələb yaradıldı'); setEmployeeId(''); setLeaveTypeId(''); onSaved(); onOpenChange(false);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Məzuniyyət tələbi</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>İşçi</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
              <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>Növ</Label>
            <Select value={leaveTypeId} onValueChange={setLeaveTypeId}><SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
              <SelectContent>{(types ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name.az}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Başlanğıc</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-2"><Label>Son</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Gün sayı: {daysBetween(start, end)}</p>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Yarat</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
