'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Pencil, FileText, FileSignature, UserX, MoreHorizontal } from 'lucide-react';
import { listEmployees, createEmployee, updateEmployee, terminateEmployee } from '@/lib/firebase/hr';
import { listDepartments } from '@/lib/firebase/departments';
import { printLaborContract, printEContractNotification } from '@/lib/hr/documents';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils/format';
import type { Employee, Company, TerminationReason } from '@/types';

interface Props { companyId: string; canCreate: boolean; actorUid: string; canViewSalary: boolean; baseCurrency: string; company?: Company }

const EMP_TYPE_LABEL: Record<string, string> = { full_time: 'Tam ştat', part_time: 'Yarım ştat', contract: 'Müqavilə' };
const TERM_LABEL: Record<TerminationReason, string> = {
  resignation: 'Ərizə ilə (öz istəyi)', mutual_agreement: 'Tərəflərin razılığı', redundancy: 'İxtisar',
  disciplinary: 'İntizam pozuntusu', contract_end: 'Müqavilə müddətinin bitməsi',
};

export function EmployeesTab({ companyId, canCreate, actorUid, canViewSalary, baseCurrency, company }: Props) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Employee | null>(null);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState<Employee | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['employees', companyId] });

  const salary = (e: Employee) => canViewSalary ? formatCurrency(e.baseSalary, e.currency ?? baseCurrency) : '•••••';
  const co = company ?? ({ name: 'Şirkət', baseCurrency } as Company);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <ExportButton filename="isciler" rows={data ?? []}
          columns={[
            { header: 'Kod', value: 'employeeCode' }, { header: 'Ad', value: (e) => `${e.firstName} ${e.lastName}` },
            { header: 'Ata adı', value: (e) => e.fatherName ?? '' }, { header: 'FİN', value: (e) => e.personalId ?? '' },
            { header: 'Vəzifə', value: (e) => e.position ?? '' }, { header: 'İş növü', value: (e) => EMP_TYPE_LABEL[e.employmentType ?? ''] ?? '' },
            { header: 'İşə qəbul', value: (e) => e.hireDate ?? '' }, { header: 'Müqavilə №', value: (e) => e.contractNumber ?? '' },
            ...(canViewSalary ? [{ header: 'Əmək haqqı', value: 'baseSalary' as const }] : []),
            { header: 'IBAN', value: (e) => e.bankAccountIban ?? '' }, { header: 'Status', value: 'status' },
          ]} />
        {canCreate && <Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" /> Yeni işçi</Button>}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="İşçi yoxdur" />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Kod</TableHead><TableHead>Ad</TableHead><TableHead>Vəzifə</TableHead><TableHead>İş növü</TableHead><TableHead className="text-right">Əmək haqqı</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-sm">{e.employeeCode}</TableCell>
                  <TableCell className="font-medium">{e.firstName} {e.lastName}{!e.laborContractNotified && !e.laborContractNotification?.submittedToEGov && <Badge variant="warning" className="ml-2">e-müqavilə bildirişi yox</Badge>}</TableCell>
                  <TableCell>{e.position ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{EMP_TYPE_LABEL[e.employmentType ?? ''] ?? '—'}</TableCell>
                  <TableCell className="text-right tnum">{salary(e)}</TableCell>
                  <TableCell><Badge variant={e.status === 'active' ? 'success' : e.status === 'on_leave' ? 'warning' : 'secondary'}>{e.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canCreate && <DropdownMenuItem onClick={() => { setEdit(e); setOpen(true); }}><Pencil className="h-4 w-4" /> Redaktə</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => printLaborContract(e, co)}><FileSignature className="h-4 w-4" /> Əmək müqaviləsi</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => printEContractNotification(e, co)}><FileText className="h-4 w-4" /> E-müqavilə bildirişi</DropdownMenuItem>
                        {canCreate && e.status !== 'terminated' && <DropdownMenuItem onClick={() => setTerm(e)} className="text-danger"><UserX className="h-4 w-4" /> İşdən azad et</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {canCreate && <EmployeeDialog open={open} onOpenChange={setOpen} companyId={companyId} actorUid={actorUid} edit={edit} baseCurrency={baseCurrency} onSaved={refresh} />}
      {term && <TerminateDialog emp={term} actorUid={actorUid} onClose={() => setTerm(null)} onDone={refresh} />}
    </div>
  );
}

function TerminateDialog({ emp, actorUid, onClose, onDone }: { emp: Employee; actorUid: string; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState<TerminationReason>('resignation');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      const { compensationDays } = await terminateEmployee(emp, date, reason, actorUid);
      toast.success('İşçi azad edildi', compensationDays > 0 ? `İstifadə olunmamış məzuniyyət kompensasiyası: ${compensationDays} gün` : 'Kompensasiya olunacaq məzuniyyət qalığı yoxdur');
      onDone(); onClose();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{emp.firstName} {emp.lastName} — işdən azad et</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Son iş günü</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-2"><Label>Səbəb</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as TerminationReason)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TERM_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
          </div>
          <p className="text-xs text-muted-foreground">İstifadə olunmamış əsas və əlavə məzuniyyət günləri (Konstitusiya Məhkəməsi 2026) avtomatik hesablanıb son ödənişə kompensasiya kimi daxil ediləcək.</p>
        </div>
        <DialogFooter><Button variant="destructive" onClick={submit} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <UserX className="h-4 w-4" />} Azad et</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeDialog({ open, onOpenChange, companyId, actorUid, edit, baseCurrency, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; edit: Employee | null; baseCurrency: string; onSaved: () => void;
}) {
  const empty = {
    code: '', first: '', last: '', father: '', fin: '', birthDate: '', gender: 'male', phone: '', email: '', address: '',
    position: '', departmentId: '', employmentType: 'full_time', hireDate: new Date().toISOString().slice(0, 10),
    contractNumber: '', contractType: 'indefinite', contractEndDate: '', salary: '', iban: '',
    notified: false, eGovRef: '',
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState('');
  const { data: departments } = useQuery({ queryKey: ['departments', companyId], queryFn: () => listDepartments(companyId), enabled: open });

  const k = (edit?.id ?? 'new') + (open ? '1' : '0');
  if (k !== key && open) {
    setKey(k);
    setForm(edit ? {
      code: edit.employeeCode ?? '', first: edit.firstName ?? '', last: edit.lastName ?? '', father: edit.fatherName ?? '',
      fin: edit.personalId ?? '', birthDate: edit.birthDate ?? '', gender: edit.gender ?? 'male', phone: edit.phone ?? '',
      email: edit.email ?? '', address: edit.address ?? '', position: edit.position ?? '', departmentId: edit.departmentId ?? '',
      employmentType: edit.employmentType ?? 'full_time', hireDate: edit.hireDate ?? '', contractNumber: edit.contractNumber ?? '',
      contractType: edit.contractType ?? 'indefinite', contractEndDate: edit.contractEndDate ?? '', salary: String(edit.baseSalary ?? ''),
      iban: edit.bankAccountIban ?? '', notified: !!(edit.laborContractNotified || edit.laborContractNotification?.submittedToEGov),
      eGovRef: edit.laborContractNotification?.eGovReferenceNumber ?? '',
    } : empty);
  }
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  async function save() {
    if (!form.first.trim() || !form.last.trim()) { toast.error('Ad və soyad tələb olunur'); return; }
    setSaving(true);
    try {
      const payload = {
        employeeCode: form.code.trim() || `EMP-${Date.now().toString().slice(-5)}`, firstName: form.first.trim(), lastName: form.last.trim(),
        fatherName: form.father.trim(), personalId: form.fin.trim(), birthDate: form.birthDate || null, gender: form.gender as 'male' | 'female',
        phone: form.phone.trim(), email: form.email.trim(), address: form.address.trim(),
        position: form.position.trim(), departmentId: form.departmentId || null, employmentType: form.employmentType as Employee['employmentType'],
        hireDate: form.hireDate || null, contractNumber: form.contractNumber.trim(), contractType: form.contractType as Employee['contractType'],
        contractEndDate: form.contractType === 'fixed_term' ? (form.contractEndDate || null) : null,
        baseSalary: Number(form.salary) || 0, currency: baseCurrency, bankAccountIban: form.iban.trim(),
        laborContractNotified: form.notified,
        laborContractNotification: { submittedToEGov: form.notified, eGovReferenceNumber: form.eGovRef.trim() || null, submittedAt: form.notified ? new Date().toISOString().slice(0, 10) : null },
      };
      if (edit) { await updateEmployee(edit.id, payload); toast.success('İşçi yeniləndi'); }
      else { await createEmployee({ companyId, ...payload, status: 'active', createdBy: actorUid } as Parameters<typeof createEmployee>[0]); toast.success('İşçi əlavə edildi'); }
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{edit ? 'İşçini redaktə et' : 'Yeni işçi (fiziki şəxs qeydiyyatı)'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Şəxsi məlumat</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Ad</Label><Input value={form.first} onChange={(e) => set({ first: e.target.value })} /></div>
              <div className="space-y-2"><Label>Soyad</Label><Input value={form.last} onChange={(e) => set({ last: e.target.value })} /></div>
              <div className="space-y-2"><Label>Ata adı</Label><Input value={form.father} onChange={(e) => set({ father: e.target.value })} /></div>
              <div className="space-y-2"><Label>FİN</Label><Input value={form.fin} onChange={(e) => set({ fin: e.target.value })} placeholder="7 simvol" /></div>
              <div className="space-y-2"><Label>Doğum tarixi</Label><Input type="date" value={form.birthDate} onChange={(e) => set({ birthDate: e.target.value })} /></div>
              <div className="space-y-2"><Label>Cins</Label>
                <Select value={form.gender} onValueChange={(v) => set({ gender: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="male">Kişi</SelectItem><SelectItem value="female">Qadın</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>Telefon</Label><Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+994 ..." /></div>
              <div className="space-y-2"><Label>E-poçt</Label><Input value={form.email} onChange={(e) => set({ email: e.target.value })} /></div>
              <div className="col-span-2 space-y-2"><Label>Ünvan</Label><Input value={form.address} onChange={(e) => set({ address: e.target.value })} /></div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vəzifə və müqavilə</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>İşçi kodu</Label><Input value={form.code} onChange={(e) => set({ code: e.target.value })} placeholder="avtomatik" /></div>
              <div className="space-y-2"><Label>Vəzifə</Label><Input value={form.position} onChange={(e) => set({ position: e.target.value })} /></div>
              <div className="space-y-2"><Label>Şöbə</Label>
                <Select value={form.departmentId} onValueChange={(v) => set({ departmentId: v })}><SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                  <SelectContent>{(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name.az}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>İş növü</Label>
                <Select value={form.employmentType} onValueChange={(v) => set({ employmentType: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="full_time">Tam ştat</SelectItem><SelectItem value="part_time">Yarım ştat</SelectItem><SelectItem value="contract">Müqavilə</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>İşə qəbul tarixi</Label><Input type="date" value={form.hireDate} onChange={(e) => set({ hireDate: e.target.value })} /></div>
              <div className="space-y-2"><Label>Müqavilə №</Label><Input value={form.contractNumber} onChange={(e) => set({ contractNumber: e.target.value })} /></div>
              <div className="space-y-2"><Label>Müqavilə növü</Label>
                <Select value={form.contractType} onValueChange={(v) => set({ contractType: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="indefinite">Müddətsiz</SelectItem><SelectItem value="fixed_term">Müddətli</SelectItem></SelectContent></Select>
              </div>
              {form.contractType === 'fixed_term' && <div className="space-y-2"><Label>Müqavilə bitmə tarixi</Label><Input type="date" value={form.contractEndDate} onChange={(e) => set({ contractEndDate: e.target.value })} /></div>}
              <div className="space-y-2"><Label>Əmək haqqı ({baseCurrency})</Label><Input type="number" value={form.salary} onChange={(e) => set({ salary: e.target.value })} /></div>
              <div className="space-y-2"><Label>IBAN (əmək haqqı)</Label><Input value={form.iban} onChange={(e) => set({ iban: e.target.value })} /></div>
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.notified} onChange={(e) => set({ notified: e.target.checked })} /> Elektron əmək müqaviləsi bildirişi göndərilib (Əmək Məcəlləsi m.49)</label>
            {form.notified && <div className="mt-3 space-y-2"><Label>e-gov qeydiyyat nömrəsi</Label><Input value={form.eGovRef} onChange={(e) => set({ eGovRef: e.target.value })} placeholder="e-social.gov.az referans" /></div>}
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : null} Yadda saxla</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
