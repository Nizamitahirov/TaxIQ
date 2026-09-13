'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Pencil } from 'lucide-react';
import { listEmployees, createEmployee, updateEmployee } from '@/lib/firebase/hr';
import { listDepartments } from '@/lib/firebase/departments';
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
import type { Employee } from '@/types';

interface Props { companyId: string; canCreate: boolean; actorUid: string; canViewSalary: boolean; baseCurrency: string }

export function EmployeesTab({ companyId, canCreate, actorUid, canViewSalary, baseCurrency }: Props) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Employee | null>(null);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId) });

  const salary = (e: Employee) => canViewSalary ? formatCurrency(e.baseSalary, e.currency ?? baseCurrency) : '•••••';

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <ExportButton filename="isciler" rows={data ?? []}
          columns={[
            { header: 'Kod', value: 'employeeCode' }, { header: 'Ad', value: (e) => `${e.firstName} ${e.lastName}` },
            { header: 'Vəzifə', value: (e) => e.position ?? '' }, { header: 'FİN', value: (e) => e.personalId ?? '' },
            ...(canViewSalary ? [{ header: 'Əmək haqqı', value: 'baseSalary' as const }] : []),
            { header: 'Status', value: 'status' },
          ]} />
        {canCreate && <Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" /> Yeni işçi</Button>}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="İşçi yoxdur" />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Kod</TableHead><TableHead>Ad</TableHead><TableHead>Vəzifə</TableHead><TableHead className="text-right">Əmək haqqı</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-sm">{e.employeeCode}</TableCell>
                  <TableCell className="font-medium">{e.firstName} {e.lastName}{!e.laborContractNotified && <Badge variant="warning" className="ml-2">e-müqavilə bildirişi yox</Badge>}</TableCell>
                  <TableCell>{e.position ?? '—'}</TableCell>
                  <TableCell className="text-right tnum">{salary(e)}</TableCell>
                  <TableCell><Badge variant={e.status === 'active' ? 'success' : e.status === 'on_leave' ? 'warning' : 'secondary'}>{e.status}</Badge></TableCell>
                  <TableCell className="text-right">{canCreate && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEdit(e); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {canCreate && <EmployeeDialog open={open} onOpenChange={setOpen} companyId={companyId} actorUid={actorUid} edit={edit} onSaved={() => qc.invalidateQueries({ queryKey: ['employees', companyId] })} />}
    </div>
  );
}

function EmployeeDialog({ open, onOpenChange, companyId, actorUid, edit, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; edit: Employee | null; onSaved: () => void;
}) {
  const [form, setForm] = useState({ code: '', first: '', last: '', position: '', fin: '', salary: '', iban: '', departmentId: '', notified: false });
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState('');
  const { data: departments } = useQuery({ queryKey: ['departments', companyId], queryFn: () => listDepartments(companyId), enabled: open });

  const k = (edit?.id ?? 'new') + (open ? '1' : '0');
  if (k !== key && open) {
    setKey(k);
    setForm({ code: edit?.employeeCode ?? '', first: edit?.firstName ?? '', last: edit?.lastName ?? '', position: edit?.position ?? '', fin: edit?.personalId ?? '', salary: String(edit?.baseSalary ?? ''), iban: edit?.bankAccountIban ?? '', departmentId: edit?.departmentId ?? '', notified: !!edit?.laborContractNotified });
  }
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  async function save() {
    if (!form.first.trim() || !form.last.trim()) { toast.error('Ad və soyad tələb olunur'); return; }
    setSaving(true);
    try {
      const payload = {
        employeeCode: form.code.trim() || `EMP-${Date.now().toString().slice(-5)}`, firstName: form.first.trim(), lastName: form.last.trim(),
        position: form.position.trim(), personalId: form.fin.trim(), baseSalary: Number(form.salary) || 0, currency: 'AZN',
        bankAccountIban: form.iban.trim(), departmentId: form.departmentId || null, laborContractNotified: form.notified, status: 'active' as const,
      };
      if (edit) { await updateEmployee(edit.id, payload); toast.success('İşçi yeniləndi'); }
      else { await createEmployee({ companyId, ...payload, createdBy: actorUid } as Parameters<typeof createEmployee>[0]); toast.success('İşçi əlavə edildi'); }
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{edit ? 'İşçini redaktə et' : 'Yeni işçi'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Ad</Label><Input value={form.first} onChange={(e) => set({ first: e.target.value })} /></div>
          <div className="space-y-2"><Label>Soyad</Label><Input value={form.last} onChange={(e) => set({ last: e.target.value })} /></div>
          <div className="space-y-2"><Label>İşçi kodu</Label><Input value={form.code} onChange={(e) => set({ code: e.target.value })} placeholder="avtomatik" /></div>
          <div className="space-y-2"><Label>FİN</Label><Input value={form.fin} onChange={(e) => set({ fin: e.target.value })} /></div>
          <div className="space-y-2"><Label>Vəzifə</Label><Input value={form.position} onChange={(e) => set({ position: e.target.value })} /></div>
          <div className="space-y-2"><Label>Əmək haqqı (AZN)</Label><Input type="number" value={form.salary} onChange={(e) => set({ salary: e.target.value })} /></div>
          <div className="space-y-2"><Label>Şöbə</Label>
            <Select value={form.departmentId} onValueChange={(v) => set({ departmentId: v })}><SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
              <SelectContent>{(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name.az}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>IBAN</Label><Input value={form.iban} onChange={(e) => set({ iban: e.target.value })} /></div>
          <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.notified} onChange={(e) => set({ notified: e.target.checked })} /> Elektron əmək müqaviləsi bildirişi göndərilib (Əmək Məcəlləsi m.49)</label>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : null} Yadda saxla</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
