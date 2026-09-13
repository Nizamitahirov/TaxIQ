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
import type { LeaveType } from '@/types';

interface Props { companyId: string; canApprove: boolean }

export function BalancesTab({ companyId, canApprove }: Props) {
  const qc = useQueryClient();
  const [year, setYear] = useState(new Date().getFullYear());
  const [busy, setBusy] = useState(false);
  const [typesOpen, setTypesOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['leaveBalances', companyId], queryFn: () => listLeaveBalances(companyId) });
  const rows = (data ?? []).filter((b) => b.year === year);

  async function rebuild() {
    setBusy(true);
    try { const n = await rebuildLeaveBalances(companyId, year); toast.success(`${n} işçi üçün ${year} balansı quruldu`); qc.invalidateQueries({ queryKey: ['leaveBalances', companyId] }); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  const flat = rows.flatMap((b) => b.balances.map((x) => ({ employeeName: b.employeeName, ...x })));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">İl</Label>
          <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-28" />
        </div>
        <div className="flex items-center gap-2">
          <ExportButton filename={`mezuniyyet-balanslari-${year}`} rows={flat} columns={[
            { header: 'İşçi', value: 'employeeName' }, { header: 'Növ', value: 'leaveTypeName' },
            { header: 'Haqq (gün)', value: 'entitledDays' }, { header: 'İstifadə', value: 'usedDays' },
            { header: 'Qalıq', value: 'remainingDays' }, { header: 'Keçirilən', value: 'carriedOver' },
          ]} />
          {canApprove && <Button variant="outline" size="sm" onClick={() => setTypesOpen(true)}><Settings2 className="h-4 w-4" /> Növlər</Button>}
          {canApprove && <Button size="sm" onClick={rebuild} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Balansı yenidən qur</Button>}
        </div>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">İlin əvvəlində əsas məzuniyyətin istifadə olunmamış qalığı növbəti ilə köçürülür (Əmək Məcəlləsi: maksimum 2 il). «Yenidən qur» aktiv işçilər üçün seçilmiş il balansını hesablayır.</p>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : rows.length === 0 ? (
        <EmptyState title="Balans yoxdur" description="«Balansı yenidən qur» ilə bu il üçün balansları yaradın." />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>İşçi</TableHead><TableHead>Növ</TableHead><TableHead className="text-right">Haqq</TableHead><TableHead className="text-right">İstifadə</TableHead><TableHead className="text-right">Qalıq</TableHead><TableHead className="text-right">Keçirilən</TableHead></TableRow></TableHeader>
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
  const { data, isLoading } = useQuery({ queryKey: ['leaveTypes', companyId], queryFn: () => listLeaveTypes(companyId) });
  const [busy, setBusy] = useState(false);
  const [na, setNa] = useState(''); const [code, setCode] = useState(''); const [days, setDays] = useState(''); const [paid, setPaid] = useState(true);
  const refresh = () => qc.invalidateQueries({ queryKey: ['leaveTypes', companyId] });

  async function seed() { setBusy(true); try { await seedLeaveTypes(companyId); toast.success('Standart növlər quruldu'); refresh(); } finally { setBusy(false); } }
  async function add() {
    if (!na.trim()) { toast.error('Ad tələb olunur'); return; }
    setBusy(true);
    try { await upsertLeaveType(companyId, { code: code.trim() || na.toLowerCase().slice(0, 8), name: { az: na.trim(), en: na.trim() }, paid, defaultDays: Number(days) || 0 }); setNa(''); setCode(''); setDays(''); refresh(); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }
  async function saveDays(t: LeaveType, d: number) { await updateLeaveType(t.id, { defaultDays: d }); refresh(); }
  async function remove(t: LeaveType) { await deleteLeaveType(t.id); refresh(); }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Məzuniyyət növləri və gün normaları</DialogTitle></DialogHeader>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (data ?? []).length === 0 ? (
          <div className="py-4 text-center"><p className="mb-3 text-sm text-muted-foreground">Növ yoxdur</p><Button size="sm" onClick={seed} disabled={busy}>Standart növləri qur (Əmək Məcəlləsi)</Button></div>
        ) : (
          <div className="space-y-2">
            {(data ?? []).map((t) => (
              <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border/60 p-2">
                <div className="flex-1"><p className="text-sm font-medium">{t.name.az}</p><p className="text-xs text-muted-foreground">{t.code} · {t.paid ? 'ödənişli' : 'ödənişsiz'}</p></div>
                <Input type="number" defaultValue={t.defaultDays} className="w-20" onBlur={(e) => { const v = Number(e.target.value); if (v !== t.defaultDays) saveDays(t, v); }} />
                <span className="text-xs text-muted-foreground">gün</span>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2 rounded-lg border border-dashed border-border p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Yeni növ</p>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Ad" value={na} onChange={(e) => setNa(e.target.value)} />
            <Input placeholder="Kod" value={code} onChange={(e) => setCode(e.target.value)} />
            <Input type="number" placeholder="Gün" value={days} onChange={(e) => setDays(e.target.value)} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Ödənişli</label>
          </div>
          <Button size="sm" className="mt-2" onClick={add} disabled={busy}><Plus className="h-4 w-4" /> Əlavə et</Button>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Bağla</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
