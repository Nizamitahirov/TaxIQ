'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Check, X, FileText } from 'lucide-react';
import { listBusinessTrips, createBusinessTrip, decideBusinessTrip, createHROrder, listEmployees } from '@/lib/firebase/hr';
import { buildOrderText } from '@/lib/hr/documents';
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
import { formatCurrency } from '@/lib/utils/format';
import type { BusinessTrip } from '@/types';

interface Props { companyId: string; canCreate: boolean; actorUid: string; canApprove: boolean; baseCurrency: string }
const days = (a: string, b: string) => Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1);
const STATUS_LABEL: Record<BusinessTrip['status'], string> = { pending: 'gözləyir', approved: 'təsdiqlənib', rejected: 'rədd', completed: 'tamamlanıb' };

export function TripsTab({ companyId, canCreate, actorUid, canApprove, baseCurrency }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['businessTrips', companyId], queryFn: () => listBusinessTrips(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['businessTrips', companyId] });

  async function decide(t: BusinessTrip, status: BusinessTrip['status']) {
    setBusyId(t.id);
    try {
      await decideBusinessTrip(t, status, actorUid);
      if (status === 'approved') {
        const { title, body } = buildOrderText('business_trip', { firstName: t.employeeName?.split(' ')[0] ?? '', lastName: t.employeeName?.split(' ').slice(1).join(' ') ?? '', position: '' } as never, { startDate: t.startDate, endDate: t.endDate, destination: t.destination, purpose: t.purpose, totalCost: formatCurrency(t.totalCost, baseCurrency) });
        await createHROrder({ companyId, type: 'business_trip', employeeId: t.employeeId, employeeName: t.employeeName, orderDate: new Date().toISOString().slice(0, 10), effectiveDate: t.startDate, title, body, createdBy: actorUid });
        qc.invalidateQueries({ queryKey: ['hrOrders', companyId] });
      }
      toast.success('Yeniləndi'); refresh();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusyId(null); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Ezamiyyətlər — təsdiqləndikdə avtomatik ezamiyyət əmri yaradılır</p>
        <div className="flex items-center gap-2">
          <ExportButton filename="ezamiyyetler" rows={data ?? []} columns={[
            { header: 'İşçi', value: 'employeeName' }, { header: 'Təyinat', value: 'destination' }, { header: 'Məqsəd', value: 'purpose' },
            { header: 'Başlanğıc', value: 'startDate' }, { header: 'Son', value: 'endDate' }, { header: 'Gün', value: 'days' },
            { header: 'Ümumi xərc', value: 'totalCost' }, { header: 'Status', value: 'status' },
          ]} />
          {canCreate && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Yeni ezamiyyət</Button>}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Ezamiyyət yoxdur" />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>İşçi</TableHead><TableHead>Təyinat</TableHead><TableHead>Tarix</TableHead><TableHead className="text-right">Gün</TableHead><TableHead className="text-right">Xərc</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.employeeName}</TableCell>
                  <TableCell>{t.destination}<span className="block text-xs text-muted-foreground">{t.purpose}</span></TableCell>
                  <TableCell className="text-muted-foreground">{t.startDate} — {t.endDate}</TableCell>
                  <TableCell className="text-right tnum">{t.days}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(t.totalCost, baseCurrency)}</TableCell>
                  <TableCell><Badge variant={t.status === 'approved' || t.status === 'completed' ? 'success' : t.status === 'rejected' ? 'destructive' : 'warning'}>{STATUS_LABEL[t.status]}</Badge></TableCell>
                  <TableCell className="text-right">
                    {canApprove && t.status === 'pending' && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-success" disabled={busyId === t.id} onClick={() => decide(t, 'approved')} title="Təsdiqlə + əmr"><Check className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" disabled={busyId === t.id} onClick={() => decide(t, 'rejected')}><X className="h-4 w-4" /></Button>
                      </div>
                    )}
                    {canApprove && t.status === 'approved' && <Button variant="ghost" size="sm" disabled={busyId === t.id} onClick={() => decide(t, 'completed')}><FileText className="h-4 w-4" /> Bitir</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {canCreate && <TripDialog open={open} onOpenChange={setOpen} companyId={companyId} actorUid={actorUid} baseCurrency={baseCurrency} onSaved={refresh} />}
    </div>
  );
}

function TripDialog({ open, onOpenChange, companyId, actorUid, baseCurrency, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; baseCurrency: string; onSaved: () => void }) {
  const [employeeId, setEmployeeId] = useState(''); const [destination, setDestination] = useState(''); const [purpose, setPurpose] = useState('');
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10)); const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [perDiem, setPerDiem] = useState('90'); const [transport, setTransport] = useState('0'); const [accommodation, setAccommodation] = useState('0');
  const [saving, setSaving] = useState(false);
  const { data: employees } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId), enabled: open });
  const d = days(start, end);
  const total = d * (Number(perDiem) || 0) + (Number(transport) || 0) + (Number(accommodation) || 0);

  async function save() {
    const emp = employees?.find((e) => e.id === employeeId);
    if (!emp) { toast.error('İşçi seçin'); return; }
    if (!destination.trim()) { toast.error('Təyinat tələb olunur'); return; }
    setSaving(true);
    try {
      await createBusinessTrip({ companyId, employeeId, employeeName: `${emp.firstName} ${emp.lastName}`, destination: destination.trim(), purpose: purpose.trim(), startDate: start, endDate: end, days: d, dailyAllowance: Number(perDiem) || 0, transportCost: Number(transport) || 0, accommodationCost: Number(accommodation) || 0, totalCost: total, createdBy: actorUid });
      toast.success('Ezamiyyət yaradıldı'); onSaved(); onOpenChange(false);
      setDestination(''); setPurpose('');
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Yeni ezamiyyət</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>İşçi</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
              <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Təyinat</Label><Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Bakı → Gəncə" /></div>
            <div className="space-y-2"><Label>Məqsəd</Label><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
            <div className="space-y-2"><Label>Başlanğıc</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-2"><Label>Son</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            <div className="space-y-2"><Label>Gündəlik norma</Label><Input type="number" value={perDiem} onChange={(e) => setPerDiem(e.target.value)} /></div>
            <div className="space-y-2"><Label>Nəqliyyat</Label><Input type="number" value={transport} onChange={(e) => setTransport(e.target.value)} /></div>
            <div className="space-y-2"><Label>Yaşayış</Label><Input type="number" value={accommodation} onChange={(e) => setAccommodation(e.target.value)} /></div>
          </div>
          <p className="text-sm font-medium">Ümumi: {formatCurrency(total, baseCurrency)} ({d} gün × norma + xərclər)</p>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Yarat</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
