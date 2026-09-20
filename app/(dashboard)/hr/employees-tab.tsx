'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Pencil, FileText, FileSignature, UserX, MoreHorizontal } from 'lucide-react';
import { listEmployees, createEmployee, updateEmployee, terminateEmployee } from '@/lib/firebase/hr';
import { listDepartments } from '@/lib/firebase/departments';
import { printLaborContract, printEContractNotification } from '@/lib/hr/documents';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { TableToolbar } from '@/components/shared/table-toolbar';
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
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency } from '@/lib/utils/format';
import type { Employee, Company, TerminationReason } from '@/types';

interface Props { companyId: string; canCreate: boolean; actorUid: string; canViewSalary: boolean; baseCurrency: string; company?: Company }

const EMP_TYPE_LABEL: Record<string, string> = { full_time: 'Tam ştat', part_time: 'Yarım ştat', contract: 'Müqavilə' };
const EMP_TYPE_LABEL_EN: Record<string, string> = { full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract' };
const TERM_LABEL: Record<TerminationReason, string> = {
  resignation: 'Ərizə ilə (öz istəyi)', mutual_agreement: 'Tərəflərin razılığı', redundancy: 'İxtisar',
  disciplinary: 'İntizam pozuntusu', contract_end: 'Müqavilə müddətinin bitməsi',
};
const TERM_LABEL_EN: Record<TerminationReason, string> = {
  resignation: 'Resignation (own request)', mutual_agreement: 'Mutual agreement', redundancy: 'Redundancy',
  disciplinary: 'Disciplinary breach', contract_end: 'End of contract term',
};

export function EmployeesTab({ companyId, canCreate, actorUid, canViewSalary, baseCurrency, company }: Props) {
  const qc = useQueryClient();
  const tt = useTT();
  const empType = (v: string) => tt(EMP_TYPE_LABEL[v] ?? '', EMP_TYPE_LABEL_EN[v] ?? '');
  const [edit, setEdit] = useState<Employee | null>(null);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState<Employee | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const { data, isLoading } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId) });
  const { data: departments } = useQuery({ queryKey: ['departments', companyId], queryFn: () => listDepartments(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['employees', companyId] });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((e) => {
      if (statusFilter && e.status !== statusFilter) return false;
      if (deptFilter && (e.departmentId ?? '') !== deptFilter) return false;
      if (q && !(`${e.firstName} ${e.lastName} ${e.employeeCode ?? ''} ${e.position ?? ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data, search, statusFilter, deptFilter]);

  const salary = (e: Employee) => canViewSalary ? formatCurrency(e.baseSalary, e.currency ?? baseCurrency) : '•••••';
  const co = company ?? ({ name: 'Şirkət', baseCurrency } as Company);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <ExportButton filename="isciler" rows={data ?? []}
          columns={[
            { header: tt('Kod', 'Code'), value: 'employeeCode' }, { header: tt('Ad', 'Name'), value: (e) => `${e.firstName} ${e.lastName}` },
            { header: tt('Ata adı', 'Father name'), value: (e) => e.fatherName ?? '' }, { header: 'FİN', value: (e) => e.personalId ?? '' },
            { header: tt('Vəzifə', 'Position'), value: (e) => e.position ?? '' }, { header: tt('İş növü', 'Employment type'), value: (e) => empType(e.employmentType ?? '') },
            { header: tt('İşə qəbul', 'Hire date'), value: (e) => e.hireDate ?? '' }, { header: tt('Müqavilə №', 'Contract №'), value: (e) => e.contractNumber ?? '' },
            ...(canViewSalary ? [{ header: tt('Əmək haqqı', 'Salary'), value: 'baseSalary' as const }] : []),
            { header: 'IBAN', value: (e) => e.bankAccountIban ?? '' }, { header: 'Status', value: 'status' },
          ]} />
        {canCreate && <Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" /> {tt('Yeni işçi', 'New employee')}</Button>}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('İşçi yoxdur', 'No employees')} />
      ) : (
        <>
        <TableToolbar
          search={search} onSearch={setSearch} searchPlaceholder={tt('Ad, kod və ya vəzifə…', 'Name, code or position…')}
          count={filtered.length} total={(data ?? []).length}
          selects={[
            { value: statusFilter, onChange: setStatusFilter, placeholder: 'Status', options: [{ value: 'active', label: tt('Aktiv', 'Active') }, { value: 'on_leave', label: tt('Məzuniyyətdə', 'On leave') }, { value: 'terminated', label: tt('İşdən çıxıb', 'Terminated') }] },
            ...(departments && departments.length > 0 ? [{ value: deptFilter, onChange: setDeptFilter, placeholder: tt('Şöbə', 'Department'), options: departments.map((d) => ({ value: d.id, label: tt(d.name.az, d.name.en) })) }] : []),
          ]}
        />
        {filtered.length === 0 ? <EmptyState title={tt('Nəticə yoxdur', 'No results')} /> : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{tt('Kod', 'Code')}</TableHead><TableHead>{tt('Ad', 'Name')}</TableHead><TableHead>{tt('Vəzifə', 'Position')}</TableHead><TableHead>{tt('İş növü', 'Employment type')}</TableHead><TableHead className="text-right">{tt('Əmək haqqı', 'Salary')}</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-sm">{e.employeeCode}</TableCell>
                  <TableCell className="font-medium">{e.firstName} {e.lastName}{!e.laborContractNotified && !e.laborContractNotification?.submittedToEGov && <Badge variant="warning" className="ml-2">{tt('e-müqavilə bildirişi yox', 'no e-contract notice')}</Badge>}</TableCell>
                  <TableCell>{e.position ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{e.employmentType ? empType(e.employmentType) : '—'}</TableCell>
                  <TableCell className="text-right tnum">{salary(e)}</TableCell>
                  <TableCell><Badge variant={e.status === 'active' ? 'success' : e.status === 'on_leave' ? 'warning' : 'secondary'}>{e.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canCreate && <DropdownMenuItem onClick={() => { setEdit(e); setOpen(true); }}><Pencil className="h-4 w-4" /> {tt('Redaktə', 'Edit')}</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => printLaborContract(e, co)}><FileSignature className="h-4 w-4" /> {tt('Əmək müqaviləsi', 'Labor contract')}</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => printEContractNotification(e, co)}><FileText className="h-4 w-4" /> {tt('E-müqavilə bildirişi', 'E-contract notice')}</DropdownMenuItem>
                        {canCreate && e.status !== 'terminated' && <DropdownMenuItem onClick={() => setTerm(e)} className="text-danger"><UserX className="h-4 w-4" /> {tt('İşdən azad et', 'Terminate')}</DropdownMenuItem>}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
        )}
        </>
      )}
      {canCreate && <EmployeeDialog open={open} onOpenChange={setOpen} companyId={companyId} actorUid={actorUid} edit={edit} baseCurrency={baseCurrency} onSaved={refresh} />}
      {term && <TerminateDialog emp={term} actorUid={actorUid} onClose={() => setTerm(null)} onDone={refresh} />}
    </div>
  );
}

function TerminateDialog({ emp, actorUid, onClose, onDone }: { emp: Employee; actorUid: string; onClose: () => void; onDone: () => void }) {
  const tt = useTT();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState<TerminationReason>('resignation');
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      const { compensationDays } = await terminateEmployee(emp, date, reason, actorUid);
      toast.success(tt('İşçi azad edildi', 'Employee terminated'), compensationDays > 0 ? `${tt('İstifadə olunmamış məzuniyyət kompensasiyası:', 'Unused leave compensation:')} ${compensationDays} ${tt('gün', 'days')}` : tt('Kompensasiya olunacaq məzuniyyət qalığı yoxdur', 'No leave balance to compensate'));
      onDone(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{emp.firstName} {emp.lastName} — {tt('işdən azad et', 'terminate')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>{tt('Son iş günü', 'Last working day')}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Səbəb', 'Reason')}</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as TerminationReason)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TERM_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{tt(v, TERM_LABEL_EN[k as TerminationReason])}</SelectItem>)}</SelectContent></Select>
          </div>
          <p className="text-xs text-muted-foreground">{tt('İstifadə olunmamış əsas və əlavə məzuniyyət günləri (Konstitusiya Məhkəməsi 2026) avtomatik hesablanıb son ödənişə kompensasiya kimi daxil ediləcək.', 'Unused basic and additional leave days (Constitutional Court 2026) are calculated automatically and added to the final payment as compensation.')}</p>
        </div>
        <DialogFooter><Button variant="destructive" onClick={submit} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <UserX className="h-4 w-4" />} {tt('Azad et', 'Terminate')}</Button></DialogFooter>
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
    isForeigner: false, citizenshipCountry: '', passportSeries: '', passportNumber: '', residencePermitFin: '',
  };
  const tt = useTT();
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
      isForeigner: !!edit.isForeigner, citizenshipCountry: edit.citizenshipCountry ?? '', passportSeries: edit.passportSeries ?? '',
      passportNumber: edit.passportNumber ?? '', residencePermitFin: edit.residencePermitFin ?? '',
    } : empty);
  }
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  async function save() {
    if (!form.first.trim() || !form.last.trim()) { toast.error(tt('Ad və soyad tələb olunur', 'First and last name are required')); return; }
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
        isForeigner: form.isForeigner,
        citizenshipCountry: form.isForeigner ? (form.citizenshipCountry.trim() || null) : null,
        passportSeries: form.isForeigner ? (form.passportSeries.trim() || null) : null,
        passportNumber: form.isForeigner ? (form.passportNumber.trim() || null) : null,
        residencePermitFin: form.isForeigner ? (form.residencePermitFin.trim() || null) : null,
        laborContractNotified: form.notified,
        laborContractNotification: { submittedToEGov: form.notified, eGovReferenceNumber: form.eGovRef.trim() || null, submittedAt: form.notified ? new Date().toISOString().slice(0, 10) : null },
      };
      if (edit) { await updateEmployee(edit.id, payload); toast.success(tt('İşçi yeniləndi', 'Employee updated')); }
      else { await createEmployee({ companyId, ...payload, status: 'active', createdBy: actorUid } as Parameters<typeof createEmployee>[0]); toast.success(tt('İşçi əlavə edildi', 'Employee added')); }
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{edit ? tt('İşçini redaktə et', 'Edit employee') : tt('Yeni işçi (fiziki şəxs qeydiyyatı)', 'New employee (individual registration)')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tt('Şəxsi məlumat', 'Personal information')}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{tt('Ad', 'First name')}</Label><Input value={form.first} onChange={(e) => set({ first: e.target.value })} /></div>
              <div className="space-y-2"><Label>{tt('Soyad', 'Last name')}</Label><Input value={form.last} onChange={(e) => set({ last: e.target.value })} /></div>
              <div className="space-y-2"><Label>{tt('Ata adı', 'Father name')}</Label><Input value={form.father} onChange={(e) => set({ father: e.target.value })} /></div>
              <div className="space-y-2"><Label>FİN</Label><Input value={form.fin} onChange={(e) => set({ fin: e.target.value })} placeholder={tt('7 simvol', '7 chars')} /></div>
              <div className="space-y-2"><Label>{tt('Doğum tarixi', 'Birth date')}</Label><Input type="date" value={form.birthDate} onChange={(e) => set({ birthDate: e.target.value })} /></div>
              <div className="space-y-2"><Label>{tt('Cins', 'Gender')}</Label>
                <Select value={form.gender} onValueChange={(v) => set({ gender: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="male">{tt('Kişi', 'Male')}</SelectItem><SelectItem value="female">{tt('Qadın', 'Female')}</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>{tt('Telefon', 'Phone')}</Label><Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+994 ..." /></div>
              <div className="space-y-2"><Label>{tt('E-poçt', 'Email')}</Label><Input value={form.email} onChange={(e) => set({ email: e.target.value })} /></div>
              <div className="col-span-2 space-y-2"><Label>{tt('Ünvan', 'Address')}</Label><Input value={form.address} onChange={(e) => set({ address: e.target.value })} /></div>
              <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isForeigner} onChange={(e) => set({ isForeigner: e.target.checked })} /> {tt('Xarici əməkdaş (FİN-siz — DSMF Hissə 4)', 'Foreign employee (no FİN — DSMF Part 4)')}</label>
              {form.isForeigner && <>
                <div className="space-y-2"><Label>{tt('Vətəndaşı olduğu ölkə', 'Citizenship country')}</Label><Input value={form.citizenshipCountry} onChange={(e) => set({ citizenshipCountry: e.target.value })} /></div>
                <div className="space-y-2"><Label>{tt('Yaşayış icazəsi FİN (varsa)', 'Residence permit FİN (if any)')}</Label><Input value={form.residencePermitFin} onChange={(e) => set({ residencePermitFin: e.target.value })} /></div>
                <div className="space-y-2"><Label>{tt('Pasport seriyası', 'Passport series')}</Label><Input value={form.passportSeries} onChange={(e) => set({ passportSeries: e.target.value })} /></div>
                <div className="space-y-2"><Label>{tt('Pasport nömrəsi', 'Passport number')}</Label><Input value={form.passportNumber} onChange={(e) => set({ passportNumber: e.target.value })} /></div>
              </>}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tt('Vəzifə və müqavilə', 'Position & contract')}</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>{tt('İşçi kodu', 'Employee code')}</Label><Input value={form.code} onChange={(e) => set({ code: e.target.value })} placeholder={tt('avtomatik', 'automatic')} /></div>
              <div className="space-y-2"><Label>{tt('Vəzifə', 'Position')}</Label><Input value={form.position} onChange={(e) => set({ position: e.target.value })} /></div>
              <div className="space-y-2"><Label>{tt('Şöbə', 'Department')}</Label>
                <Select value={form.departmentId} onValueChange={(v) => set({ departmentId: v })}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
                  <SelectContent>{(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{tt(d.name.az, d.name.en)}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>{tt('İş növü', 'Employment type')}</Label>
                <Select value={form.employmentType} onValueChange={(v) => set({ employmentType: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="full_time">{tt('Tam ştat', 'Full-time')}</SelectItem><SelectItem value="part_time">{tt('Yarım ştat', 'Part-time')}</SelectItem><SelectItem value="contract">{tt('Müqavilə', 'Contract')}</SelectItem></SelectContent></Select>
              </div>
              <div className="space-y-2"><Label>{tt('İşə qəbul tarixi', 'Hire date')}</Label><Input type="date" value={form.hireDate} onChange={(e) => set({ hireDate: e.target.value })} /></div>
              <div className="space-y-2"><Label>{tt('Müqavilə №', 'Contract №')}</Label><Input value={form.contractNumber} onChange={(e) => set({ contractNumber: e.target.value })} /></div>
              <div className="space-y-2"><Label>{tt('Müqavilə növü', 'Contract type')}</Label>
                <Select value={form.contractType} onValueChange={(v) => set({ contractType: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="indefinite">{tt('Müddətsiz', 'Indefinite')}</SelectItem><SelectItem value="fixed_term">{tt('Müddətli', 'Fixed-term')}</SelectItem></SelectContent></Select>
              </div>
              {form.contractType === 'fixed_term' && <div className="space-y-2"><Label>{tt('Müqavilə bitmə tarixi', 'Contract end date')}</Label><Input type="date" value={form.contractEndDate} onChange={(e) => set({ contractEndDate: e.target.value })} /></div>}
              <div className="space-y-2"><Label>{tt('Əmək haqqı', 'Salary')} ({baseCurrency})</Label><Input type="number" value={form.salary} onChange={(e) => set({ salary: e.target.value })} /></div>
              <div className="space-y-2"><Label>{tt('IBAN (əmək haqqı)', 'IBAN (salary)')}</Label><Input value={form.iban} onChange={(e) => set({ iban: e.target.value })} /></div>
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.notified} onChange={(e) => set({ notified: e.target.checked })} /> {tt('Elektron əmək müqaviləsi bildirişi göndərilib (Əmək Məcəlləsi m.49)', 'Electronic labor contract notice submitted (Labor Code art. 49)')}</label>
            {form.notified && <div className="mt-3 space-y-2"><Label>{tt('e-gov qeydiyyat nömrəsi', 'e-gov registration number')}</Label><Input value={form.eGovRef} onChange={(e) => set({ eGovRef: e.target.value })} placeholder={tt('e-social.gov.az referans', 'e-social.gov.az reference')} /></div>}
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : null} {tt('Yadda saxla', 'Save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
