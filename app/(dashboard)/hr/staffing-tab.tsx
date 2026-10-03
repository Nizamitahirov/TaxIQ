'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, ClipboardList } from 'lucide-react';
import { listStaffingPositions, createStaffingPosition, deleteStaffingPosition, reconcileStaffing, staffingTotals } from '@/lib/firebase/staffing';
import { listEmployees } from '@/lib/firebase/hr';
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
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency } from '@/lib/utils/format';

interface Props { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function StaffingTab({ companyId, canCreate, actorUid, baseCurrency }: Props) {
  const tt = useTT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: positions, isLoading } = useQuery({ queryKey: ['staffingPositions', companyId], queryFn: () => listStaffingPositions(companyId) });
  const { data: employees } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['staffingPositions', companyId] });

  const rows = useMemo(() => reconcileStaffing(positions ?? [], employees ?? []), [positions, employees]);
  const totals = useMemo(() => staffingTotals(rows), [rows]);

  return (
    <div className="mt-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{tt('Ştat cədvəli — vəzifə, say, maaş dərəcəsi; faktiki işçi sayı ilə müqayisə.', 'Staffing table — positions, headcount, salary grade; compared with actual staff.')}</p>
        <div className="flex items-center gap-2">
          <ExportButton filename="stat-cedveli" rows={rows} columns={[
            { header: tt('Vəzifə', 'Position'), value: 'title' }, { header: tt('Şöbə', 'Department'), value: (r) => r.departmentName ?? '' },
            { header: tt('Plan', 'Planned'), value: 'plannedCount' }, { header: tt('Faktiki', 'Actual'), value: 'actualCount' }, { header: tt('Boş', 'Vacant'), value: 'vacant' },
          ]} />
          {canCreate && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni vəzifə', 'New position')}</Button>}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label={tt('Ştat vahidi (plan)', 'Planned units')} value={totals.planned} />
        <Stat label={tt('Tutulmuş', 'Filled')} value={totals.actual} />
        <Stat label={tt('Boş ştat', 'Vacant')} value={totals.vacant} tint={totals.vacant > 0 ? 'text-amber-600' : undefined} />
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : rows.length === 0 ? <EmptyState title={tt('Ştat cədvəli boşdur', 'Staffing table is empty')} description={tt('Vəzifələri əlavə edin', 'Add positions')} />
        : <Card className="rounded-card"><CardContent className="overflow-x-auto p-0"><Table>
            <TableHeader><TableRow>
              <TableHead>{tt('Vəzifə', 'Position')}</TableHead><TableHead>{tt('Şöbə', 'Department')}</TableHead>
              <TableHead className="text-right">{tt('Plan', 'Planned')}</TableHead><TableHead className="text-right">{tt('Faktiki', 'Actual')}</TableHead>
              <TableHead className="text-right">{tt('Boş', 'Vacant')}</TableHead><TableHead className="text-right">{tt('Maaş dərəcəsi', 'Salary grade')}</TableHead><TableHead className="w-10" />
            </TableRow></TableHeader>
            <TableBody>{rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell className="text-muted-foreground">{r.departmentName ?? '—'}</TableCell>
                <TableCell className="text-right tnum">{r.plannedCount}</TableCell>
                <TableCell className="text-right tnum">{r.actualCount}</TableCell>
                <TableCell className="text-right">{r.overStaffed ? <Badge variant="destructive">+{r.actualCount - r.plannedCount}</Badge> : r.vacant > 0 ? <Badge variant="warning">{r.vacant}</Badge> : <Badge variant="success">0</Badge>}</TableCell>
                <TableCell className="text-right tnum text-muted-foreground">{r.salaryMin || r.salaryMax ? `${formatCurrency(r.salaryMin ?? 0, baseCurrency)} – ${formatCurrency(r.salaryMax ?? 0, baseCurrency)}` : '—'}</TableCell>
                <TableCell>{canCreate && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => { if (confirm(tt('Silinsin?', 'Delete?'))) deleteStaffingPosition(r, actorUid).then(refresh); }}><Trash2 className="h-3.5 w-3.5" /></Button>}</TableCell>
              </TableRow>))}</TableBody>
          </Table></CardContent></Card>}

      {open && <PositionDialog companyId={companyId} actorUid={actorUid} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refresh(); }} />}
    </div>
  );
}

function Stat({ label, value, tint }: { label: string; value: number; tint?: string }) {
  return <Card className="rounded-card"><CardContent className="p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`text-2xl font-bold tnum ${tint ?? ''}`}>{value}</p></CardContent></Card>;
}

function PositionDialog({ companyId, actorUid, onClose, onSaved }: { companyId: string; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const { data: departments } = useQuery({ queryKey: ['departments', companyId], queryFn: () => listDepartments(companyId) });
  const [f, setF] = useState({ title: '', departmentId: '', plannedCount: '1', salaryMin: '', salaryMax: '' });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p }));
  async function save() {
    if (!f.title.trim()) { toast.error(tt('Vəzifə adı lazımdır', 'Title required')); return; }
    setSaving(true);
    try {
      const dep = (departments ?? []).find((d) => d.id === f.departmentId);
      await createStaffingPosition({
        companyId, title: f.title.trim(), departmentId: f.departmentId || null, departmentName: dep ? dep.name.az : null,
        plannedCount: Number(f.plannedCount) || 1, salaryMin: f.salaryMin ? Number(f.salaryMin) : null, salaryMax: f.salaryMax ? Number(f.salaryMax) : null,
        createdBy: actorUid,
      });
      toast.success(tt('Vəzifə əlavə edildi', 'Position added')); onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-md">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> {tt('Yeni ştat vahidi', 'New staffing position')}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2"><Label>{tt('Vəzifə *', 'Position *')}</Label><Input value={f.title} onChange={(e) => set({ title: e.target.value })} /></div>
        <div className="space-y-1 sm:col-span-2"><Label>{tt('Şöbə', 'Department')}</Label>
          <Select value={f.departmentId} onValueChange={(v) => set({ departmentId: v })}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name.az}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>{tt('Ştat sayı', 'Headcount')}</Label><Input type="number" value={f.plannedCount} onChange={(e) => set({ plannedCount: e.target.value })} /></div>
        <div />
        <div className="space-y-1"><Label>{tt('Maaş (min)', 'Salary (min)')}</Label><Input type="number" value={f.salaryMin} onChange={(e) => set({ salaryMin: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Maaş (max)', 'Salary (max)')}</Label><Input type="number" value={f.salaryMax} onChange={(e) => set({ salaryMax: e.target.value })} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Əlavə et', 'Add')}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}
