'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, RefreshCw } from 'lucide-react';
import { listMonthlyTimesheets, seedTimesheets, upsertTimesheet, setTimesheetStatus } from '@/lib/firebase/hr';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import type { MonthlyTimesheet } from '@/types';

interface Props { companyId: string; canCreate: boolean; actorUid: string; canApprove: boolean }
const STATUS_LABEL: Record<MonthlyTimesheet['status'], string> = { draft: 'qaralama', submitted: 'təqdim', approved: 'təsdiq' };
const STATUS_LABEL_EN: Record<MonthlyTimesheet['status'], string> = { draft: 'draft', submitted: 'submitted', approved: 'approved' };

export function TimesheetTab({ companyId, canCreate, actorUid, canApprove }: Props) {
  const qc = useQueryClient();
  const tt = useTT();
  const [ym, setYm] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['timesheets', companyId, ym], queryFn: () => listMonthlyTimesheets(companyId, ym) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['timesheets', companyId, ym] });

  async function seed() {
    setBusy(true);
    try { const n = await seedTimesheets(companyId, ym); toast.success(`${n} ${tt('işçi üçün tabel quruldu', 'timesheets built')}`); refresh(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }
  async function editRow(t: MonthlyTimesheet, patch: Partial<MonthlyTimesheet>) {
    await upsertTimesheet({ ...t, ...patch }); refresh();
  }
  async function approve(t: MonthlyTimesheet) {
    await setTimesheetStatus(t.id, 'approved', actorUid); toast.success(tt('Tabel təsdiqləndi', 'Timesheet approved'), tt('Overtime saatları payrola daxil ediləcək', 'Overtime hours will be included in payroll')); refresh();
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Label className="text-sm text-muted-foreground">{tt('Ay', 'Month')}</Label><Input type="month" value={ym} onChange={(e) => setYm(e.target.value)} className="w-40" /></div>
        <div className="flex items-center gap-2">
          <ExportButton filename={`tabel-${ym}`} rows={data ?? []} columns={[
            { header: tt('İşçi', 'Employee'), value: 'employeeName' }, { header: tt('İş saatı', 'Worked hours'), value: 'totalWorkedHours' }, { header: 'Overtime', value: 'totalOvertimeHours' },
            { header: tt('İş günü', 'Worked days'), value: 'workedDays' }, { header: tt('Qayıb', 'Absence'), value: 'absenceDays' }, { header: tt('Məzuniyyət', 'Leave'), value: 'leaveDays' }, { header: tt('Xəstəlik', 'Sick'), value: 'sickDays' }, { header: 'Status', value: 'status' },
          ]} />
          {canCreate && <Button size="sm" onClick={seed} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {tt('Tabeli qur (40s/həftə)', 'Build timesheet (40h/week)')}</Button>}
        </div>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{tt('Yalnız «təsdiq» statuslu aylıq tabel əmək haqqı hesablamasına daxil edilir (10 §5.2). Overtime saatlarını redaktə edib təsdiqləyin.', 'Only monthly timesheets with “approved” status are included in payroll (10 §5.2). Edit overtime hours and approve.')}</p>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Tabel yoxdur', 'No timesheets')} description={tt('Bu ay üçün «Tabeli qur» ilə standart tabel yaradın.', 'Create a standard timesheet for this month with “Build timesheet”.')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{tt('İşçi', 'Employee')}</TableHead><TableHead className="text-right">{tt('İş saatı', 'Worked hours')}</TableHead><TableHead className="text-right">Overtime</TableHead><TableHead className="text-right">{tt('İş günü', 'Worked days')}</TableHead><TableHead className="text-right">{tt('Qayıb', 'Absence')}</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((t) => {
                const editable = canCreate && t.status !== 'approved';
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.employeeName}</TableCell>
                    <TableCell className="text-right">{editable ? <Input type="number" defaultValue={t.totalWorkedHours} className="ml-auto w-20 text-right" onBlur={(e) => { const v = Number(e.target.value); if (v !== t.totalWorkedHours) editRow(t, { totalWorkedHours: v }); }} /> : <span className="tnum">{t.totalWorkedHours}</span>}</TableCell>
                    <TableCell className="text-right">{editable ? <Input type="number" defaultValue={t.totalOvertimeHours} className="ml-auto w-20 text-right" onBlur={(e) => { const v = Number(e.target.value); if (v !== t.totalOvertimeHours) editRow(t, { totalOvertimeHours: v }); }} /> : <span className="tnum">{t.totalOvertimeHours}</span>}</TableCell>
                    <TableCell className="text-right tnum">{t.workedDays}</TableCell>
                    <TableCell className="text-right">{editable ? <Input type="number" defaultValue={t.absenceDays} className="ml-auto w-16 text-right" onBlur={(e) => { const v = Number(e.target.value); if (v !== t.absenceDays) editRow(t, { absenceDays: v }); }} /> : <span className="tnum">{t.absenceDays}</span>}</TableCell>
                    <TableCell><Badge variant={t.status === 'approved' ? 'success' : t.status === 'submitted' ? 'warning' : 'secondary'}>{tt(STATUS_LABEL[t.status], STATUS_LABEL_EN[t.status])}</Badge></TableCell>
                    <TableCell className="text-right">
                      {canCreate && t.status === 'draft' && <Button variant="ghost" size="sm" onClick={() => editRow(t, { status: 'submitted' })}>{tt('Təqdim et', 'Submit')}</Button>}
                      {canApprove && t.status === 'submitted' && <Button variant="ghost" size="sm" className="text-success" onClick={() => approve(t)}><Check className="h-4 w-4" /> {tt('Təsdiqlə', 'Approve')}</Button>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
