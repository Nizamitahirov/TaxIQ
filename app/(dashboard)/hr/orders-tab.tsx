'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Printer, Ban } from 'lucide-react';
import { listHROrders, createHROrder, cancelHROrder, listEmployees } from '@/lib/firebase/hr';
import { buildOrderText, printHROrder, ORDER_TYPE_LABEL, ORDER_TYPE_LABEL_EN } from '@/lib/hr/documents';
import { useTT } from '@/lib/i18n/tt';
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
import type { Company, HROrder, HROrderType, Employee } from '@/types';

interface Props { companyId: string; canCreate: boolean; actorUid: string; company?: Company }

export function OrdersTab({ companyId, canCreate, actorUid, company }: Props) {
  const qc = useQueryClient();
  const tt = useTT();
  const typeLabel = (t: HROrderType) => tt(ORDER_TYPE_LABEL[t], ORDER_TYPE_LABEL_EN[t]);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['hrOrders', companyId], queryFn: () => listHROrders(companyId) });
  const co = company ?? ({ name: 'Şirkət', baseCurrency: 'AZN' } as Company);
  const refresh = () => qc.invalidateQueries({ queryKey: ['hrOrders', companyId] });

  async function cancel(o: HROrder) { await cancelHROrder(o.id); toast.success(tt('Əmr ləğv edildi', 'Order cancelled')); refresh(); }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tt('Kadr əmrləri (işə qəbul, azad etmə, məzuniyyət, ezamiyyət, mükafat və s.)', 'HR orders (hire, termination, leave, business trip, bonus, etc.)')}</p>
        <div className="flex items-center gap-2">
          <ExportButton filename="kadr-emrleri" rows={data ?? []} columns={[
            { header: tt('Nömrə', 'Number'), value: 'orderNumber' }, { header: tt('Növ', 'Type'), value: (o) => typeLabel(o.type) }, { header: tt('İşçi', 'Employee'), value: 'employeeName' },
            { header: tt('Tarix', 'Date'), value: 'orderDate' }, { header: tt('Qüvvəyə minmə', 'Effective date'), value: 'effectiveDate' }, { header: 'Status', value: 'status' },
          ]} />
          {canCreate && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni əmr', 'New order')}</Button>}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Əmr yoxdur', 'No orders')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>№</TableHead><TableHead>{tt('Növ', 'Type')}</TableHead><TableHead>{tt('İşçi', 'Employee')}</TableHead><TableHead>{tt('Tarix', 'Date')}</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                  <TableCell>{typeLabel(o.type)}</TableCell>
                  <TableCell className="font-medium">{o.employeeName}</TableCell>
                  <TableCell className="text-muted-foreground">{o.orderDate}</TableCell>
                  <TableCell><Badge variant={o.status === 'issued' ? 'success' : o.status === 'cancelled' ? 'secondary' : 'warning'}>{o.status === 'issued' ? tt('verilib', 'issued') : o.status === 'cancelled' ? tt('ləğv', 'cancelled') : tt('qaralama', 'draft')}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={tt('Çap', 'Print')} onClick={() => printHROrder(o, co)}><Printer className="h-4 w-4" /></Button>
                      {canCreate && o.status === 'issued' && <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" title={tt('Ləğv et', 'Cancel')} onClick={() => cancel(o)}><Ban className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {canCreate && <OrderDialog open={open} onOpenChange={setOpen} companyId={companyId} actorUid={actorUid} onSaved={refresh} />}
    </div>
  );
}

function OrderDialog({ open, onOpenChange, companyId, actorUid, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; onSaved: () => void }) {
  const tt = useTT();
  const [type, setType] = useState<HROrderType>('hire');
  const [employeeId, setEmployeeId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const { data: employees } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId), enabled: open });

  function regen(nextType: HROrderType, empId: string) {
    const emp = employees?.find((e) => e.id === empId);
    if (!emp) { setTitle(''); setBody(''); return; }
    const { title: t, body: b } = buildOrderText(nextType, emp as Employee, { effectiveDate, salary: String(emp.baseSalary ?? '') });
    setTitle(t); setBody(b);
  }

  async function save() {
    const emp = employees?.find((e) => e.id === employeeId);
    if (!emp) { toast.error(tt('İşçi seçin', 'Select an employee')); return; }
    if (!title.trim()) { toast.error(tt('Başlıq tələb olunur', 'Title is required')); return; }
    setSaving(true);
    try {
      await createHROrder({ companyId, type, employeeId, employeeName: `${emp.firstName} ${emp.lastName}`, orderDate, effectiveDate, title: title.trim(), body: body.trim(), createdBy: actorUid });
      toast.success(tt('Əmr verildi', 'Order issued')); onSaved(); onOpenChange(false);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{tt('Yeni kadr əmri', 'New HR order')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Əmr növü', 'Order type')}</Label>
              <Select value={type} onValueChange={(v) => { setType(v as HROrderType); regen(v as HROrderType, employeeId); }}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(ORDER_TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{tt(v, ORDER_TYPE_LABEL_EN[k as HROrderType])}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>{tt('İşçi', 'Employee')}</Label>
              <Select value={employeeId} onValueChange={(v) => { setEmployeeId(v); regen(type, v); }}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
                <SelectContent>{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>{tt('Əmr tarixi', 'Order date')}</Label><Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Qüvvəyə minmə', 'Effective date')}</Label><Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>{tt('Başlıq', 'Title')}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Mətn (redaktə edilə bilər)', 'Text (editable)')}</Label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Əmri ver', 'Issue order')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
