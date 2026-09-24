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
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency } from '@/lib/utils/format';
import type { BusinessTrip } from '@/types';

interface Props { companyId: string; canCreate: boolean; actorUid: string; canApprove: boolean; baseCurrency: string }
const days = (a: string, b: string) => Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000) + 1);
const STATUS_LABEL: Record<BusinessTrip['status'], string> = { pending: 'gözləyir', approved: 'təsdiqlənib', rejected: 'rədd', completed: 'tamamlanıb' };
const STATUS_LABEL_EN: Record<BusinessTrip['status'], string> = { pending: 'pending', approved: 'approved', rejected: 'rejected', completed: 'completed' };

export function TripsTab({ companyId, canCreate, actorUid, canApprove, baseCurrency }: Props) {
  const qc = useQueryClient();
  const tt = useTT();
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
      toast.success(tt('Yeniləndi', 'Updated')); refresh();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusyId(null); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tt('Ezamiyyətlər — təsdiqləndikdə avtomatik ezamiyyət əmri yaradılır', 'Business trips — on approval a business-trip order is created automatically')}</p>
        <div className="flex items-center gap-2">
          <ExportButton filename="ezamiyyetler" rows={data ?? []} columns={[
            { header: tt('İşçi', 'Employee'), value: 'employeeName' }, { header: tt('Təyinat', 'Destination'), value: 'destination' }, { header: tt('Məqsəd', 'Purpose'), value: 'purpose' },
            { header: tt('Başlanğıc', 'Start'), value: 'startDate' }, { header: tt('Son', 'End'), value: 'endDate' }, { header: tt('Gün', 'Days'), value: 'days' },
            { header: tt('Ümumi xərc', 'Total cost'), value: 'totalCost' }, { header: 'Status', value: 'status' },
          ]} />
          {canCreate && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni ezamiyyət', 'New trip')}</Button>}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Ezamiyyət yoxdur', 'No business trips')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{tt('İşçi', 'Employee')}</TableHead><TableHead>{tt('Təyinat', 'Destination')}</TableHead><TableHead>{tt('Tarix', 'Date')}</TableHead><TableHead className="text-right">{tt('Gün', 'Days')}</TableHead><TableHead className="text-right">{tt('Xərc', 'Cost')}</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.employeeName}</TableCell>
                  <TableCell>{t.destination}<span className="block text-xs text-muted-foreground">{t.purpose}</span></TableCell>
                  <TableCell className="text-muted-foreground">{t.startDate} — {t.endDate}</TableCell>
                  <TableCell className="text-right tnum">{t.days}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(t.totalCost, baseCurrency)}</TableCell>
                  <TableCell><Badge variant={t.status === 'approved' || t.status === 'completed' ? 'success' : t.status === 'rejected' ? 'destructive' : 'warning'}>{tt(STATUS_LABEL[t.status], STATUS_LABEL_EN[t.status])}</Badge></TableCell>
                  <TableCell className="text-right">
                    {canApprove && t.status === 'pending' && (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-success" disabled={busyId === t.id} onClick={() => decide(t, 'approved')} title={tt('Təsdiqlə + əmr', 'Approve + order')}><Check className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" disabled={busyId === t.id} onClick={() => decide(t, 'rejected')}><X className="h-4 w-4" /></Button>
                      </div>
                    )}
                    {canApprove && t.status === 'approved' && <Button variant="ghost" size="sm" disabled={busyId === t.id} onClick={() => decide(t, 'completed')}><FileText className="h-4 w-4" /> {tt('Bitir', 'Finish')}</Button>}
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
  const tt = useTT();
  const [employeeId, setEmployeeId] = useState(''); const [destination, setDestination] = useState(''); const [purpose, setPurpose] = useState('');
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10)); const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [perDiem, setPerDiem] = useState('90'); const [transport, setTransport] = useState('0'); const [accommodation, setAccommodation] = useState('0');
  const [saving, setSaving] = useState(false);
  const { data: employees } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId), enabled: open });
  const d = days(start, end);
  const total = d * (Number(perDiem) || 0) + (Number(transport) || 0) + (Number(accommodation) || 0);

  async function save() {
    const emp = employees?.find((e) => e.id === employeeId);
    if (!emp) { toast.error(tt('İşçi seçin', 'Select an employee')); return; }
    if (!destination.trim()) { toast.error(tt('Təyinat tələb olunur', 'Destination is required')); return; }
    setSaving(true);
    try {
      await createBusinessTrip({ companyId, employeeId, employeeName: `${emp.firstName} ${emp.lastName}`, destination: destination.trim(), purpose: purpose.trim(), startDate: start, endDate: end, days: d, dailyAllowance: Number(perDiem) || 0, transportCost: Number(transport) || 0, accommodationCost: Number(accommodation) || 0, totalCost: total, createdBy: actorUid });
      toast.success(tt('Ezamiyyət yaradıldı', 'Business trip created')); onSaved(); onOpenChange(false);
      setDestination(''); setPurpose('');
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{tt('Yeni ezamiyyət', 'New business trip')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>{tt('İşçi', 'Employee')}</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
              <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Təyinat', 'Destination')}</Label><Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Bakı → Gəncə" /></div>
            <div className="space-y-2"><Label>{tt('Məqsəd', 'Purpose')}</Label><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Başlanğıc', 'Start')}</Label><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Son', 'End')}</Label><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Gündəlik norma', 'Daily allowance')}</Label><Input type="number" value={perDiem} onChange={(e) => setPerDiem(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Nəqliyyat', 'Transport')}</Label><Input type="number" value={transport} onChange={(e) => setTransport(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Yaşayış', 'Accommodation')}</Label><Input type="number" value={accommodation} onChange={(e) => setAccommodation(e.target.value)} /></div>
          </div>
          <p className="text-sm font-medium">{tt('Ümumi', 'Total')}: {formatCurrency(total, baseCurrency)} ({d} {tt('gün × norma + xərclər', 'days × allowance + costs')})</p>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
