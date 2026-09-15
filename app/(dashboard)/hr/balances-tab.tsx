'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, Settings2, Plus, Trash2 } from 'lucide-react';
import { listLeaveBalances, rebuildLeaveBalances, listLeaveTypes, seedLeaveTypes, upsertLeaveType, updateLeaveType, deleteLeaveType } from '@/lib/firebase/hr';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import type { LeaveType } from '@/types';

interface Props { companyId: string; canApprove: boolean }

export function BalancesTab({ companyId, canApprove }: Props) {
  const qc = useQueryClient();
  const tt = useTT();
  const [year, setYear] = useState(new Date().getFullYear());
  const [busy, setBusy] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['leaveBalances', companyId], queryFn: () => listLeaveBalances(companyId) });
  const rows = (data ?? []).filter((b) => b.year === year);

  async function rebuild() {
    setBusy(true);
    try { const n = await rebuildLeaveBalances(companyId, year); toast.success(`${n} ${tt('işçi üçün', 'employees')} ${year} ${tt('balansı quruldu', 'balances built')}`); qc.invalidateQueries({ queryKey: ['leaveBalances', companyId] }); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  const flat = rows.flatMap((b) => b.balances.map((x) => ({ employeeName: b.employeeName, ...x })));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">{tt('İl', 'Year')}</Label>
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28" />
        </div>
        <div className="flex items-center gap-2">
          <ExportButton filename={`mezuniyyet-balanslari-${year}`} rows={flat} columns={[
            { header: tt('İşçi', 'Employee'), value: 'employeeName' }, { header: tt('Növ', 'Type'), value: 'leaveTypeName' },
            { header: tt('Haqq (gün)', 'Entitled (days)'), value: 'entitledDays' }, { header: tt('İstifadə', 'Used'), value: 'usedDays' },
            { header: tt('Qalıq', 'Remaining'), value: 'remainingDays' }, { header: tt('Keçirilən', 'Carried over'), value: 'carriedOver' },
          ]} />
          {canApprove && <Button variant="outline" size="sm" onClick={() => setTypesOpen(true)}><Settings2 className="h-4 w-4" /> {tt('Növlər', 'Types')}</Button>}
          {canApprove && <Button size="sm" onClick={rebuild} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {tt('Balansı yenidən qur', 'Rebuild balances')}</Button>}
        </div>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{tt('İlin əvvəlində əsas məzuniyyətin istifadə olunmamış qalığı növbəti ilə köçürülür (Əmək Məcəlləsi: maksimum 2 il). «Yenidən qur» aktiv işçilər üçün seçilmiş il balansını hesablayır.', 'At the start of the year, unused basic leave balance carries over to the next year (Labor Code: max 2 years). “Rebuild” calculates the selected year’s balance for active employees.')}</p>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : rows.length === 0 ? (
        <EmptyState title={tt('Balans yoxdur', 'No balances')} description={tt('«Balansı yenidən qur» ilə bu il üçün balansları yaradın.', 'Create this year’s balances with “Rebuild balances”.')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{tt('İşçi', 'Employee')}</TableHead><TableHead>{tt('Növ', 'Type')}</TableHead><TableHead className="text-right">{tt('Haqq', 'Entitled')}</TableHead><TableHead className="text-right">{tt('İstifadə', 'Used')}</TableHead><TableHead className="text-right">{tt('Qalıq', 'Remaining')}</TableHead><TableHead className="text-right">{tt('Keçirilən', 'Carried')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((b) => b.balances.map((x, i) => (
                <TableRow key={b.id + x.leaveTypeId}>
                  {i === 0 && <TableCell rowSpan={b.balances.length} className="align-top font-medium">{b.employeeName}</TableCell>}
                  <TableCell>{x.leaveTypeName}</TableCell>
                  <TableCell className="text-right tnum">{x.entitledDays}</TableCell>
                  <TableCell className="text-right tnum">{x.usedDays}</TableCell>
                  <TableCell className="text-right tnum font-semibold"><Badge variant={x.remainingDays < 0 ? 'destructive' : x.remainingDays === 0 ? 'secondary' : 'success'}>{x.remainingDays}</Badge></TableCell>
                  <TableCell className="text-right tnum text-muted-foreground">{x.carriedOver || '—'}</TableCell>
                </TableRow>
              )))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {typesOpen && <LeaveTypesDialog companyId={companyId} onClose={() => setTypesOpen(false)} />}
    </div>
  );
}

function LeaveTypesDialog({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const tt = useTT();
  const { data, isLoading } = useQuery({ queryKey: ['leaveTypes', companyId], queryFn: () => listLeaveTypes(companyId) });
  const [busy, setBusy] = useState(false);
  const [na, setNa] = useState(''); const [code, setCode] = useState(''); const [days, setDays] = useState(''); const [paid, setPaid] = useState(true);
  const refresh = () => qc.invalidateQueries({ queryKey: ['leaveTypes', companyId] });

  async function seed() { setBusy(true); try { await seedLeaveTypes(companyId); toast.success(tt('Standart növlər quruldu', 'Standard types set up')); refresh(); } finally { setBusy(false); } }
  async function add() {
    if (!na.trim()) { toast.error(tt('Ad tələb olunur', 'Name is required')); return; }
    setBusy(true);
    try { await upsertLeaveType(companyId, { code: code.trim() || na.toLowerCase().slice(0, 8), name: { az: na.trim(), en: na.trim() }, paid, defaultDays: Number(days) || 0 }); setNa(''); setCode(''); setDays(''); refresh(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }
  async function saveDays(t: LeaveType, d: number) { await updateLeaveType(t.id, { defaultDays: d }); refresh(); }
  async function remove(t: LeaveType) { await deleteLeaveType(t.id); refresh(); }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{tt('Məzuniyyət növləri və gün normaları', 'Leave types and day norms')}</DialogTitle></DialogHeader>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (data ?? []).length === 0 ? (
          <div className="py-4 text-center"><p className="mb-3 text-sm text-muted-foreground">{tt('Növ yoxdur', 'No types')}</p><Button size="sm" onClick={seed} disabled={busy}>{tt('Standart növləri qur (Əmək Məcəlləsi)', 'Set up standard types (Labor Code)')}</Button></div>
        ) : (
          <div className="space-y-2">
            {(data ?? []).map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border/60 p-2">
                <div className="flex-1"><p className="text-sm font-medium">{tt(t.name.az, t.name.en)}</p><p className="text-xs text-muted-foreground">{t.code} · {t.paid ? tt('ödənişli', 'paid') : tt('ödənişsiz', 'unpaid')}</p></div>
                <Input type="number" defaultValue={t.defaultDays} className="w-20" onBlur={(e) => { const v = Number(e.target.value); if (v !== t.defaultDays) saveDays(t, v); }} />
                <span className="text-xs text-muted-foreground">{tt('gün', 'days')}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 rounded-lg border border-dashed border-border p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{tt('Yeni növ', 'New type')}</p>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder={tt('Ad', 'Name')} value={na} onChange={(e) => setNa(e.target.value)} />
            <Input placeholder={tt('Kod', 'Code')} value={code} onChange={(e) => setCode(e.target.value)} />
            <Input type="number" placeholder={tt('Gün', 'Days')} value={days} onChange={(e) => setDays(e.target.value)} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> {tt('Ödənişli', 'Paid')}</label>
          </div>
          <Button size="sm" className="mt-2" onClick={add} disabled={busy}><Plus className="h-4 w-4" /> {tt('Əlavə et', 'Add')}</Button>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Bağla', 'Close')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
