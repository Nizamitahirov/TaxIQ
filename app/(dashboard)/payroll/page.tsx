'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Check, Banknote, FileText, Printer, Info } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  listPayrollRuns, calculatePayrollRun, approvePayrollRun, markPayrollPaid, getActiveTaxConfig,
} from '@/lib/firebase/hr';
import { exportToCsv } from '@/lib/utils/export';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils/format';
import { printPayslips } from './print-payslip';
import type { PayrollRun } from '@/types';

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];

export default function PayrollPage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const qc = useQueryClient();
  const companyId = active?.companyId;
  const base = active?.company.baseCurrency ?? 'AZN';
  const canView = isSuperAdmin || can('payroll.run.view');
  const canRun = isSuperAdmin || can('payroll.run.create');
  const canApprove = isSuperAdmin || can('payroll.run.approve');
  const [detail, setDetail] = useState<PayrollRun | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['payrollRuns', companyId], queryFn: () => listPayrollRuns(companyId!), enabled: !!companyId && canView });
  const { data: taxCfg } = useQuery({ queryKey: ['taxcfg'], queryFn: getActiveTaxConfig, enabled: canView });

  if (!companyId) return <div><PageHeader title="Əmək haqqı" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Aktiv şirkət seçin.</CardContent></Card></div>;
  if (!canView) return <div><PageHeader title="Əmək haqqı" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">İcazə yoxdur.</CardContent></Card></div>;

  const now = new Date();
  function invalidate() { qc.invalidateQueries({ queryKey: ['payrollRuns', companyId] }); qc.invalidateQueries({ queryKey: ['journal', companyId] }); }

  async function run() {
    setBusy(true);
    try { await calculatePayrollRun(companyId!, now.getMonth() + 1, now.getFullYear(), profile?.uid ?? ''); toast.success('Dövr hesablandı'); invalidate(); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }
  async function approve(r: PayrollRun) {
    setBusy(true);
    try { await approvePayrollRun(r, base, profile?.uid ?? ''); toast.success('Təsdiqləndi', 'Konsolidasiya jurnal yazısı yaradıldı'); invalidate(); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }
  async function pay(r: PayrollRun) {
    setBusy(true);
    try {
      await markPayrollPaid(r, profile?.uid ?? '');
      // Salary bulk faylı (CSV)
      exportToCsv(`emek-haqqi-${r.periodYear}-${r.periodMonth}`, [
        { header: 'İşçi', value: 'employeeName' }, { header: 'Net məbləğ', value: 'netSalary' },
      ], r.lines);
      toast.success('Ödənildi kimi işarələndi', 'Bank toplu faylı (CSV) yükləndi');
      invalidate();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="Əmək haqqı" subtitle={`${active?.company.name} · payroll (Modul 10)`}
        action={canRun && <Button onClick={run} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {MONTHS[now.getMonth()]} {now.getFullYear()} hesabla</Button>} />

      <div className="mb-4 flex items-start gap-2 rounded-card border border-info/20 bg-info/5 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        Vergi/sığorta dərəcələri versiyalanan konfiqurasiyadan götürülür (sərt kodlaşdırma yoxdur). Aktiv versiya: <span className="font-medium">{taxCfg?.effectiveFrom ?? '—'}</span>. {taxCfg?.notes}
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Əmək haqqı dövrü yoxdur" description="Aktiv işçilər üçün yuxarıdakı düymə ilə dövr hesablayın." />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Dövr</TableHead><TableHead>İşçi</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Net</TableHead><TableHead className="text-right">İşəgötürən xərci</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{MONTHS[r.periodMonth - 1]} {r.periodYear}</TableCell>
                  <TableCell>{r.lines.length}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(r.totalGross, base)}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(r.totalNet, base)}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(r.totalEmployerCost, base)}</TableCell>
                  <TableCell><Badge variant={r.status === 'paid' ? 'success' : r.status === 'approved' ? 'default' : 'secondary'}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Detallar" onClick={() => setDetail(r)}><FileText className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Payslip çap" onClick={() => printPayslips(r, active!.company, base)}><Printer className="h-4 w-4" /></Button>
                      {canApprove && r.status === 'calculated' && <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Təsdiqlə" disabled={busy} onClick={() => approve(r)}><Check className="h-4 w-4" /></Button>}
                      {canApprove && r.status === 'approved' && <Button variant="ghost" size="icon" className="h-8 w-8 text-success" title="Ödə (bank faylı)" disabled={busy} onClick={() => pay(r)}><Banknote className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>{detail && `${MONTHS[detail.periodMonth - 1]} ${detail.periodYear}`} — detallar</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="flex justify-end"><ExportButton filename={`payroll-${detail.periodYear}-${detail.periodMonth}`} rows={detail.lines}
                columns={[
                  { header: 'İşçi', value: 'employeeName' }, { header: 'Gross', value: 'grossSalary' },
                  { header: 'Gəlir vergisi', value: 'incomeTax' }, { header: 'Sosial', value: 'employeeSocialInsurance' },
                  { header: 'Tibbi', value: 'employeeMedicalInsurance' }, { header: 'İşsizlik', value: 'employeeUnemploymentInsurance' },
                  { header: 'Net', value: 'netSalary' }, { header: 'İşəgötürən xərci', value: 'totalEmployerCost' },
                ]} /></div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>İşçi</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Gəlir v.</TableHead><TableHead className="text-right">Sosial</TableHead><TableHead className="text-right">Tibbi</TableHead><TableHead className="text-right">İşsizlik</TableHead><TableHead className="text-right">Net</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {detail.lines.map((l) => (
                      <TableRow key={l.employeeId}>
                        <TableCell className="font-medium">{l.employeeName}</TableCell>
                        <TableCell className="text-right tnum">{formatCurrency(l.grossSalary, base)}</TableCell>
                        <TableCell className="text-right tnum">{formatCurrency(l.incomeTax, base)}</TableCell>
                        <TableCell className="text-right tnum">{formatCurrency(l.employeeSocialInsurance, base)}</TableCell>
                        <TableCell className="text-right tnum">{formatCurrency(l.employeeMedicalInsurance, base)}</TableCell>
                        <TableCell className="text-right tnum">{formatCurrency(l.employeeUnemploymentInsurance, base)}</TableCell>
                        <TableCell className="text-right tnum font-semibold">{formatCurrency(l.netSalary, base)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
