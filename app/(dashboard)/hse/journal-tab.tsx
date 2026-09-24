'use client';

import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Loader2, Settings2, Upload, FileCheck2, AlertTriangle, CheckCircle2, Clock, Trash2, Paperclip, GraduationCap,
} from 'lucide-react';
import {
  listHseTrainingTypes, listHseTrainingRecords, createHseTrainingRecord, saveHseTrainingType, deleteHseTrainingType,
  attachSignedDoc, deleteHseTrainingRecord, trainingStatus, daysUntil,
} from '@/lib/firebase/hse';
import { listEmployees } from '@/lib/firebase/hr';
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
import { cn } from '@/lib/utils/cn';
import type { HseTrainingRecord, HseTrainingType } from '@/types';

const STATUS = {
  valid: { label: 'Etibarlı', en: 'Valid', variant: 'success' as const, icon: CheckCircle2 },
  expiring: { label: 'Bitir', en: 'Expiring', variant: 'warning' as const, icon: Clock },
  expired: { label: 'Vaxtı keçib', en: 'Expired', variant: 'destructive' as const, icon: AlertTriangle },
};

export function JournalTab({ companyId, uid, canEdit, canConfig, canDelete }: { companyId: string; uid: string; canEdit: boolean; canConfig: boolean; canDelete: boolean }) {
  const qc = useQueryClient();
  const tt = useTT();
  const [addOpen, setAddOpen] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const attachRef = useRef<HTMLInputElement>(null);
  const [attachTarget, setAttachTarget] = useState<HseTrainingRecord | null>(null);
  const [attaching, setAttaching] = useState(false);

  const { data: records, isLoading } = useQuery({ queryKey: ['hseTraining', companyId], queryFn: () => listHseTrainingRecords(companyId) });
  const { data: types } = useQuery({ queryKey: ['hseTypes', companyId], queryFn: () => listHseTrainingTypes(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['hseTraining', companyId] });

  const rows = useMemo(() => (records ?? []).map((r) => ({ r, st: trainingStatus(r.nextDueDate), days: daysUntil(r.nextDueDate) })), [records]);
  const expiringCount = rows.filter((x) => x.st !== 'valid').length;

  async function onAttach(file: File | undefined) {
    if (!file || !attachTarget) return;
    setAttaching(true);
    try { await attachSignedDoc(attachTarget, file, companyId); toast.success(tt('İmzalı sənəd əlavə edildi', 'Signed document attached')); refresh(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setAttaching(false); setAttachTarget(null); }
  }
  async function remove(r: HseTrainingRecord) {
    if (!window.confirm(tt('Qeyd silinsin?', 'Delete record?'))) return;
    try { await deleteHseTrainingRecord(r); toast.success(tt('Silindi', 'Deleted')); refresh(); } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
  }

  return (
    <div>
      <input ref={attachRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { onAttach(e.target.files?.[0]); e.target.value = ''; }} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{tt('İşçilərin SƏTƏM təlimindən keçmə tarixi, imzalı sənəd və yenidən təlimə qalan gün sayı.', 'Employees’ HSE training completion date, signed document and days remaining until retraining.')}{expiringCount > 0 && <span className="ml-1 font-medium text-warning">{expiringCount} {tt('qeyd diqqət tələb edir.', 'records need attention.')}</span>}</p>
        <div className="flex gap-2">
          <ExportButton filename="setem-jurnali" rows={records ?? []} columns={[
            { header: tt('İşçi', 'Employee'), value: 'employeeName' }, { header: tt('Təlim', 'Training'), value: 'trainingTypeName' },
            { header: tt('Keçmə tarixi', 'Completed date'), value: 'completedDate' }, { header: tt('Növbəti tarix', 'Next date'), value: 'nextDueDate' },
            { header: tt('İmzalı sənəd', 'Signed doc'), value: (r) => r.signedDocUploadedAt ? tt('Bəli', 'Yes') : tt('Xeyr', 'No') },
          ]} />
          {canConfig && <Button variant="outline" size="sm" onClick={() => setCfgOpen(true)}><Settings2 className="h-4 w-4" /> {tt('Təlim növləri', 'Training types')}</Button>}
          {canEdit && <Button size="sm" onClick={() => setAddOpen(true)} disabled={(types ?? []).length === 0}><Plus className="h-4 w-4" /> {tt('Qeyd əlavə et', 'Add record')}</Button>}
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : rows.length === 0 ? (
        <EmptyState title={tt('Jurnal boşdur', 'Journal is empty')} description={(types ?? []).length === 0 ? tt('Əvvəlcə "Təlim növləri"ni konfiqurasiya edin.', 'First configure the “Training types”.') : tt('İlk təlim qeydini əlavə edin.', 'Add the first training record.')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{tt('İşçi', 'Employee')}</TableHead><TableHead>{tt('Təlim növü', 'Training type')}</TableHead><TableHead>{tt('Keçmə tarixi', 'Completed date')}</TableHead>
              <TableHead>{tt('Növbəti təlim', 'Next training')}</TableHead><TableHead className="text-center">{tt('Qalan gün', 'Days left')}</TableHead>
              <TableHead>{tt('İmzalı sənəd', 'Signed doc')}</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map(({ r, st, days }) => {
                const S = STATUS[st];
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.employeeName}</TableCell>
                    <TableCell>{r.trainingTypeName} <span className="text-xs text-muted-foreground">({r.validityMonths} {tt('ay', 'mo')})</span></TableCell>
                    <TableCell className="text-muted-foreground">{r.completedDate}</TableCell>
                    <TableCell>{r.nextDueDate}</TableCell>
                    <TableCell className={cn('text-center font-semibold tnum', st === 'expired' ? 'text-danger' : st === 'expiring' ? 'text-warning' : 'text-muted-foreground')}>{days < 0 ? `${days}` : days}</TableCell>
                    <TableCell>
                      {r.signedDocUrl ? (
                        <a href={r.signedDocUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-success hover:underline"><FileCheck2 className="h-3.5 w-3.5" /> {r.signedDocUploadedAt?.slice(0, 10)}</a>
                      ) : canEdit ? (
                        <button onClick={() => { setAttachTarget(r); attachRef.current?.click(); }} disabled={attaching} className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"><Paperclip className="h-3 w-3" /> {tt('Yüklə', 'Upload')}</button>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell><Badge variant={S.variant}><S.icon className="mr-1 h-3 w-3" /> {tt(S.label, S.en)}</Badge></TableCell>
                    <TableCell className="text-right">{canDelete && <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => remove(r)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      {addOpen && <AddDialog companyId={companyId} uid={uid} types={types ?? []} onClose={() => setAddOpen(false)} onSaved={refresh} />}
      {cfgOpen && <ConfigDialog companyId={companyId} types={types ?? []} onClose={() => setCfgOpen(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['hseTypes', companyId] })} />}
    </div>
  );
}

function AddDialog({ companyId, uid, types, onClose, onSaved }: { companyId: string; uid: string; types: HseTrainingType[]; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const { data: employees } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId) });
  const [employeeId, setEmployeeId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save() {
    const emp = employees?.find((e) => e.id === employeeId);
    const type = types.find((t) => t.id === typeId);
    if (!emp || !type) { toast.error(tt('İşçi və təlim növü seçin', 'Select an employee and training type')); return; }
    setBusy(true);
    try {
      await createHseTrainingRecord({
        companyId, employeeId: emp.id, employeeName: `${emp.firstName} ${emp.lastName}`,
        trainingTypeId: type.id, trainingTypeName: type.name, validityMonths: type.validityMonths,
        completedDate: date, note: note || null, signedDoc: file, uid,
      });
      toast.success(tt('Qeyd əlavə edildi', 'Record added'));
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" /> {tt('SƏTƏM təlim qeydi', 'HSE training record')}</DialogTitle></DialogHeader>
        <input ref={fileRef} type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <div className="space-y-3">
          <div className="space-y-2"><Label>{tt('İşçi', 'Employee')}</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
              <SelectContent className="max-h-72">{(employees ?? []).map((e) => <SelectItem key={e.id} value={e.id}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>{tt('Təlim növü', 'Training type')}</Label>
            <Select value={typeId} onValueChange={setTypeId}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
              <SelectContent>{types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {t.validityMonths} {tt('ay', 'mo')}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>{tt('Təlimdən keçmə tarixi', 'Training completion date')}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('İmzalı skan sənəd (PDF/şəkil, seçimlik)', 'Signed scanned document (PDF/image, optional)')}</Label>
            <Button type="button" variant="outline" className="w-full justify-start" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> {file ? file.name : tt('Fayl seç', 'Choose file')}</Button>
          </div>
          <div className="space-y-2"><Label>{tt('Qeyd (seçimlik)', 'Note (optional)')}</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yadda saxla', 'Save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConfigDialog({ companyId, types, onClose, onSaved }: { companyId: string; types: HseTrainingType[]; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [name, setName] = useState('');
  const [months, setMonths] = useState('12');
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim() || !(Number(months) > 0)) { toast.error(tt('Ad və interval daxil edin', 'Enter a name and interval')); return; }
    setBusy(true);
    try { await saveHseTrainingType({ companyId, name, validityMonths: Number(months) }); setName(''); setMonths('12'); onSaved(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }
  async function remove(t: HseTrainingType) {
    if (!window.confirm(`"${t.name}" ${tt('silinsin?', 'delete?')}`)) return;
    try { await deleteHseTrainingType(t.id); onSaved(); } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" /> {tt('Təlim növləri və interval', 'Training types and interval')}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{tt('Hər təlim növü üçün neçə aydan sonra yenidən təlim tələb olunduğunu təyin edin.', 'For each training type, set how many months later retraining is required.')}</p>
        <div className="mt-2 flex items-end gap-2">
          <div className="flex-1 space-y-1"><Label className="text-xs">{tt('Təlim adı', 'Training name')}</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={tt('məs. Yanğın təhlükəsizliyi', 'e.g. Fire safety')} /></div>
          <div className="w-24 space-y-1"><Label className="text-xs">{tt('İnterval (ay)', 'Interval (mo)')}</Label><Input type="number" value={months} onChange={(e) => setMonths(e.target.value)} /></div>
          <Button onClick={add} disabled={busy} size="icon">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}</Button>
        </div>
        <div className="mt-3 space-y-1.5">
          {types.length === 0 ? <p className="py-4 text-center text-xs text-muted-foreground">{tt('Hələ təlim növü yoxdur.', 'No training types yet.')}</p> : types.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
              <span className="flex-1 text-sm font-medium">{t.name}</span>
              <Badge variant="secondary">{t.validityMonths} {tt('ay', 'mo')}</Badge>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-danger" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Bağla', 'Close')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
