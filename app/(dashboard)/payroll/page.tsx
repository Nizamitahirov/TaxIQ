'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Check, Banknote, FileText, Printer, Info, SlidersHorizontal, Settings2, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import {
  listPayrollRuns, calculatePayrollRun, approvePayrollRun, markPayrollPaid, getActiveTaxConfig,
  listEmployees, listPayrollAdjustments, savePayrollAdjustment, saveTaxConfig,
} from '@/lib/firebase/hr';
import { DEFAULT_TAX_CONFIG } from '@/lib/payroll/tax';
import { exportToCsv, exportToExcel } from '@/lib/utils/export';
import { PageHeader } from '@/components/shared/page-header';
import { StatutoryReportsPanel } from './statutory-reports';
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
import { formatCurrency } from '@/lib/utils/format';
import { printPayslips } from './print-payslip';
import type { PayrollRun, PayrollTaxConfig } from '@/types';

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const round2 = (n: number) => Math.round(n * 100) / 100;
/** İşəgötürənin öhdəlikləri (gross → super-gross fərqi) */
const employerBurden = (l: { employerSocialInsurance: number; employerMedicalInsurance: number; employerUnemploymentInsurance: number }) =>
  round2(l.employerSocialInsurance + l.employerMedicalInsurance + l.employerUnemploymentInsurance);

export default function PayrollPage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const tt = useTT();
  const month = (i: number) => tt(MONTHS[i], MONTHS_EN[i]);
  const qc = useQueryClient();
  const companyId = active?.companyId;
  const base = active?.company.baseCurrency ?? 'AZN';
  const canView = isSuperAdmin || can('payroll.run.view');
  const canRun = isSuperAdmin || can('payroll.run.create');
  const canApprove = isSuperAdmin || can('payroll.run.approve');
  const [detail, setDetail] = useState<PayrollRun | null>(null);
  const [adjOpen, setAdjOpen] = useState(false);
  const [cfgOpen, setCfgOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['payrollRuns', companyId], queryFn: () => listPayrollRuns(companyId!), enabled: !!companyId && canView });
  const { data: taxCfg } = useQuery({ queryKey: ['taxcfg'], queryFn: getActiveTaxConfig, enabled: canView });

  if (!companyId) return <div><PageHeader title={tt('Əmək haqqı', 'Payroll')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('Aktiv şirkət seçin.', 'Select an active company.')}</CardContent></Card></div>;
  if (!canView) return <div><PageHeader title={tt('Əmək haqqı', 'Payroll')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('İcazə yoxdur.', 'No permission.')}</CardContent></Card></div>;

  const now = new Date();
  function invalidate() { qc.invalidateQueries({ queryKey: ['payrollRuns', companyId] }); qc.invalidateQueries({ queryKey: ['journal', companyId] }); }

  async function run() {
    setBusy(true);
    try { await calculatePayrollRun(companyId!, now.getMonth() + 1, now.getFullYear(), profile?.uid ?? ''); toast.success(tt('Dövr hesablandı', 'Period calculated'), tt('Aylıq düzəlişlər (overtime/bonus/kəsinti) daxil edildi', 'Monthly adjustments (overtime/bonus/deductions) included')); invalidate(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }
  async function approve(r: PayrollRun) {
    setBusy(true);
    try { await approvePayrollRun(r, base, profile?.uid ?? ''); toast.success(tt('Təsdiqləndi', 'Approved'), tt('Konsolidasiya jurnal yazısı yaradıldı', 'Consolidation journal entry created')); invalidate(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }
  async function pay(r: PayrollRun) {
    setBusy(true);
    try {
      await markPayrollPaid(r, profile?.uid ?? '');
      exportToCsv(`emek-haqqi-${r.periodYear}-${r.periodMonth}`, [
        { header: tt('İşçi', 'Employee'), value: 'employeeName' }, { header: tt('Net məbləğ', 'Net amount'), value: 'netSalary' },
      ], r.lines);
      toast.success(tt('Ödənildi kimi işarələndi', 'Marked as paid'), tt('Bank toplu faylı (CSV) yükləndi', 'Bank bulk file (CSV) downloaded'));
      invalidate();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }
  function taxDeclaration(r: PayrollRun) {
    // Dövlət Vergi Xidməti / DSMF bəyannaməsi strukturu (10 §8)
    exportToExcel(`vergi-beyannamesi-${r.periodYear}-${r.periodMonth}`, [
      { header: tt('İşçi', 'Employee'), value: 'employeeName' }, { header: 'Gross', value: 'grossSalary' },
      { header: tt('Gəlir vergisi', 'Income tax'), value: 'incomeTax' },
      { header: tt('İşçi sosial (DSMF)', 'Employee social (SSPF)'), value: 'employeeSocialInsurance' }, { header: tt('İşəgötürən sosial (DSMF)', 'Employer social (SSPF)'), value: 'employerSocialInsurance' },
      { header: tt('İşçi tibbi', 'Employee medical'), value: 'employeeMedicalInsurance' }, { header: tt('İşəgötürən tibbi', 'Employer medical'), value: 'employerMedicalInsurance' },
      { header: tt('İşçi işsizlik', 'Employee unemployment'), value: 'employeeUnemploymentInsurance' }, { header: tt('İşəgötürən işsizlik', 'Employer unemployment'), value: 'employerUnemploymentInsurance' },
      { header: 'Net', value: 'netSalary' },
    ], r.lines, tt('Bəyannamə', 'Declaration'));
    toast.success(tt('Vergi/DSMF bəyannaməsi ixrac edildi', 'Tax/SSPF declaration exported'), tt('Rəsmi portala əl ilə yükləyin', 'Upload it manually to the official portal'));
  }

  return (
    <div>
      <PageHeader title={tt('Əmək haqqı', 'Payroll')} subtitle={`${active?.company.name} · payroll (${tt('Modul 10', 'Module 10')})`}
        action={<div className="flex flex-wrap items-center gap-2">
          {canRun && <Button variant="outline" size="sm" onClick={() => setAdjOpen(true)}><SlidersHorizontal className="h-4 w-4" /> {tt('Düzəlişlər', 'Adjustments')}</Button>}
          {canApprove && <Button variant="outline" size="sm" onClick={() => setCfgOpen(true)}><Settings2 className="h-4 w-4" /> {tt('Vergi konfiqurasiyası', 'Tax config')}</Button>}
          {canRun && <Button onClick={run} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {month(now.getMonth())} {now.getFullYear()} {tt('hesabla', 'calculate')}</Button>}
        </div>} />

      <div className="mb-4 flex items-start gap-2 rounded-card border border-info/20 bg-info/5 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        {tt('Vergi/sığorta dərəcələri versiyalanan konfiqurasiyadan götürülür (sərt kodlaşdırma yoxdur). Aktiv versiya:', 'Tax/insurance rates are taken from a versioned configuration (no hardcoding). Active version:')} <span className="font-medium">{taxCfg?.effectiveFrom ?? '—'}</span>. {taxCfg?.notes}
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Əmək haqqı dövrü yoxdur', 'No payroll periods')} description={tt('Aktiv işçilər üçün yuxarıdakı düymə ilə dövr hesablayın.', 'Calculate a period for active employees using the button above.')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{tt('Dövr', 'Period')}</TableHead><TableHead>{tt('İşçi', 'Employees')}</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Net</TableHead><TableHead className="text-right">{tt('İşəgötürən xərci', 'Employer cost')}</TableHead><TableHead className="text-right">Super-gross</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{month(r.periodMonth - 1)} {r.periodYear}</TableCell>
                  <TableCell>{r.lines.length}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(r.totalGross, base)}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(r.totalNet, base)}</TableCell>
                  <TableCell className="text-right tnum text-amber-600">{formatCurrency(round2(r.totalEmployerCost - r.totalGross), base)}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(r.totalEmployerCost, base)}</TableCell>
                  <TableCell><Badge variant={r.status === 'paid' ? 'success' : r.status === 'approved' ? 'default' : 'secondary'}>{r.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={tt('Detallar', 'Details')} onClick={() => setDetail(r)}><FileText className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={tt('Payslip çap', 'Print payslip')} onClick={() => printPayslips(r, active!.company, base)}><Printer className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={tt('Vergi/DSMF bəyannaməsi', 'Tax/SSPF declaration')} onClick={() => taxDeclaration(r)}><FileSpreadsheet className="h-4 w-4" /></Button>
                      {canApprove && r.status === 'calculated' && <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title={tt('Təsdiqlə', 'Approve')} disabled={busy} onClick={() => approve(r)}><Check className="h-4 w-4" /></Button>}
                      {canApprove && r.status === 'approved' && <Button variant="ghost" size="icon" className="h-8 w-8 text-success" title={tt('Ödə (bank faylı)', 'Pay (bank file)')} disabled={busy} onClick={() => pay(r)}><Banknote className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>{detail && `${month(detail.periodMonth - 1)} ${detail.periodYear}`} — {tt('detallar (net / gross / super-gross)', 'details (net / gross / super-gross)')}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="flex justify-end"><ExportButton filename={`payroll-${detail.periodYear}-${detail.periodMonth}`} rows={detail.lines}
                columns={[
                  { header: tt('İşçi', 'Employee'), value: 'employeeName' }, { header: tt('Baza', 'Base'), value: 'baseSalary' }, { header: 'Overtime', value: 'overtimePay' }, { header: 'Bonus', value: 'bonuses' },
                  { header: 'Gross', value: 'grossSalary' }, { header: tt('Gəlir vergisi', 'Income tax'), value: 'incomeTax' }, { header: tt('Sosial', 'Social'), value: 'employeeSocialInsurance' },
                  { header: tt('Tibbi', 'Medical'), value: 'employeeMedicalInsurance' }, { header: tt('İşsizlik', 'Unemployment'), value: 'employeeUnemploymentInsurance' }, { header: tt('Kəsinti', 'Deduction'), value: 'otherDeductions' },
                  { header: 'Net', value: 'netSalary' },
                  { header: tt('İşəgötürən sosial', 'Employer social'), value: 'employerSocialInsurance' }, { header: tt('İşəgötürən tibbi', 'Employer medical'), value: 'employerMedicalInsurance' }, { header: tt('İşəgötürən işsizlik', 'Employer unemployment'), value: 'employerUnemploymentInsurance' },
                  { header: tt('İşəgötürən cəmi', 'Employer total'), value: (l) => employerBurden(l) },
                  { header: 'Super-gross', value: 'totalEmployerCost' },
                ]} /></div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>{tt('İşçi', 'Employee')}</TableHead><TableHead className="text-right">{tt('Baza', 'Base')}</TableHead><TableHead className="text-right">OT/Bonus</TableHead><TableHead className="text-right">Gross</TableHead>
                    <TableHead className="text-right">{tt('Gəlir v.', 'Inc. tax')}</TableHead><TableHead className="text-right">{tt('Sosial', 'Social')}</TableHead><TableHead className="text-right">{tt('Tibbi', 'Medical')}</TableHead><TableHead className="text-right">{tt('İşsizlik', 'Unempl.')}</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="text-right text-amber-600">{tt('İş.gt. sosial', 'Empr. social')}</TableHead><TableHead className="text-right text-amber-600">{tt('İş.gt. tibbi', 'Empr. medical')}</TableHead><TableHead className="text-right text-amber-600">{tt('İş.gt. işsizlik', 'Empr. unempl.')}</TableHead><TableHead className="text-right text-amber-600">{tt('İşəgötürən cəmi', 'Employer total')}</TableHead>
                    <TableHead className="text-right">Super-gross</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {detail.lines.map((l) => (
                      <TableRow key={l.employeeId}>
                        <TableCell className="font-medium">{l.employeeName}</TableCell>
                        <TableCell className="text-right tnum">{formatCurrency(l.baseSalary, base)}</TableCell>
                        <TableCell className="text-right tnum">{formatCurrency(l.overtimePay + l.bonuses, base)}</TableCell>
                        <TableCell className="text-right tnum font-medium">{formatCurrency(l.grossSalary, base)}</TableCell>
                        <TableCell className="text-right tnum">{formatCurrency(l.incomeTax, base)}</TableCell>
                        <TableCell className="text-right tnum">{formatCurrency(l.employeeSocialInsurance, base)}</TableCell>
                        <TableCell className="text-right tnum">{formatCurrency(l.employeeMedicalInsurance, base)}</TableCell>
                        <TableCell className="text-right tnum">{formatCurrency(l.employeeUnemploymentInsurance, base)}</TableCell>
                        <TableCell className="text-right tnum font-semibold text-primary">{formatCurrency(l.netSalary, base)}</TableCell>
                        <TableCell className="text-right tnum text-amber-600/90">{formatCurrency(l.employerSocialInsurance, base)}</TableCell>
                        <TableCell className="text-right tnum text-amber-600/90">{formatCurrency(l.employerMedicalInsurance, base)}</TableCell>
                        <TableCell className="text-right tnum text-amber-600/90">{formatCurrency(l.employerUnemploymentInsurance, base)}</TableCell>
                        <TableCell className="text-right tnum font-semibold text-amber-600">{formatCurrency(employerBurden(l), base)}</TableCell>
                        <TableCell className="text-right tnum text-muted-foreground">{formatCurrency(l.totalEmployerCost, base)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">{tt('Net = işçiyə ödənilən · Gross = vergi/sığortadan əvvəl · İşəgötürən cəmi = işəgötürənin sosial+tibbi+işsizlik öhdəlikləri (gross → super-gross fərqi, şirkətin əlavə xərci) · Super-gross = gross + işəgötürən öhdəlikləri (tam əmək xərci).', 'Net = paid to the employee · Gross = before tax/insurance · Employer total = employer social+medical+unemployment liabilities (gross → super-gross difference, the company’s extra cost) · Super-gross = gross + employer liabilities (total labor cost).')}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {active?.company && <StatutoryReportsPanel companyId={companyId} company={active.company} canView={canView} />}

      {adjOpen && <AdjustmentsDialog companyId={companyId} year={now.getFullYear()} month={now.getMonth() + 1} base={base} onClose={() => setAdjOpen(false)} />}
      {cfgOpen && <TaxConfigDialog current={taxCfg ?? DEFAULT_TAX_CONFIG} onClose={() => setCfgOpen(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['taxcfg'] })} />}
    </div>
  );
}

/** Aylıq overtime / bonus / kəsinti düzəlişləri (hesablamadan əvvəl) */
function AdjustmentsDialog({ companyId, year, month, base, onClose }: { companyId: string; year: number; month: number; base: string; onClose: () => void }) {
  const qc = useQueryClient();
  const tt = useTT();
  const monthName = (i: number) => tt(MONTHS[i], MONTHS_EN[i]);
  const { data: employees, isLoading } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId) });
  const { data: adjustments } = useQuery({ queryKey: ['payrollAdjustments', companyId, year, month], queryFn: () => listPayrollAdjustments(companyId, year, month) });
  const [busyId, setBusyId] = useState<string | null>(null);
  const active = (employees ?? []).filter((e) => e.status === 'active');
  const adjMap = new Map((adjustments ?? []).map((a) => [a.employeeId, a]));

  async function save(employeeId: string, patch: { overtimePay?: number; bonuses?: number; otherDeductions?: number }) {
    const cur = adjMap.get(employeeId);
    setBusyId(employeeId);
    try {
      await savePayrollAdjustment({ companyId, employeeId, periodYear: year, periodMonth: month,
        overtimePay: patch.overtimePay ?? cur?.overtimePay ?? 0, bonuses: patch.bonuses ?? cur?.bonuses ?? 0, otherDeductions: patch.otherDeductions ?? cur?.otherDeductions ?? 0 });
      qc.invalidateQueries({ queryKey: ['payrollAdjustments', companyId, year, month] });
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusyId(null); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{monthName(month - 1)} {year} — {tt('aylıq düzəlişlər', 'monthly adjustments')} ({base})</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{tt('Bu dəyərlər növbəti hesablamada gross-a (overtime + bonus) və net-dən (kəsinti) tətbiq olunur.', 'These values are applied to gross (overtime + bonus) and from net (deduction) in the next calculation.')}</p>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>{tt('İşçi', 'Employee')}</TableHead><TableHead className="text-right">Overtime</TableHead><TableHead className="text-right">Bonus</TableHead><TableHead className="text-right">{tt('Kəsinti', 'Deduction')}</TableHead></TableRow></TableHeader>
              <TableBody>
                {active.map((e) => {
                  const a = adjMap.get(e.id);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.firstName} {e.lastName}{busyId === e.id && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}</TableCell>
                      <TableCell className="text-right"><Input type="number" defaultValue={a?.overtimePay ?? 0} className="ml-auto w-24 text-right" onBlur={(ev) => { const v = Number(ev.target.value); if (v !== (a?.overtimePay ?? 0)) save(e.id, { overtimePay: v }); }} /></TableCell>
                      <TableCell className="text-right"><Input type="number" defaultValue={a?.bonuses ?? 0} className="ml-auto w-24 text-right" onBlur={(ev) => { const v = Number(ev.target.value); if (v !== (a?.bonuses ?? 0)) save(e.id, { bonuses: v }); }} /></TableCell>
                      <TableCell className="text-right"><Input type="number" defaultValue={a?.otherDeductions ?? 0} className="ml-auto w-24 text-right" onBlur={(ev) => { const v = Number(ev.target.value); if (v !== (a?.otherDeductions ?? 0)) save(e.id, { otherDeductions: v }); }} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Bağla', 'Close')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Versiyalanan vergi konfiqurasiyası — yeni versiya əlavə et (10 §6.1) */
function TaxConfigDialog({ current, onClose, onSaved }: { current: PayrollTaxConfig; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [minimumWage, setMinimumWage] = useState(String(current.minimumWage));
  const [incomeLow, setIncomeLow] = useState(String((current.incomeTaxBrackets[0]?.rate ?? 0.14) * 100));
  const [threshold, setThreshold] = useState(String(current.incomeTaxBrackets[0]?.uptoAmount ?? 2500));
  const [incomeHigh, setIncomeHigh] = useState(String((current.incomeTaxBrackets[1]?.rate ?? 0.25) * 100));
  const [socEmpBase, setSocEmpBase] = useState(String(current.socialInsurance.employeeBaseRate * 100));
  const [socEmpAbove, setSocEmpAbove] = useState(String(current.socialInsurance.employeeRateAboveThreshold * 100));
  const [socEr, setSocEr] = useState(String(current.socialInsurance.employerRate * 100));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const th = Number(threshold);
      const lowRate = Number(incomeLow) / 100;
      const cfg: Omit<PayrollTaxConfig, 'id'> = {
        effectiveFrom, effectiveTo: null, minimumWage: Number(minimumWage),
        incomeTaxBrackets: [
          { uptoAmount: th, rate: lowRate, fixedAmount: 0 },
          { uptoAmount: null, rate: Number(incomeHigh) / 100, fixedAmount: Math.round(th * lowRate * 100) / 100 },
        ],
        socialInsurance: { employeeBaseRate: Number(socEmpBase) / 100, employeeBaseThreshold: current.socialInsurance.employeeBaseThreshold, employeeRateAboveThreshold: Number(socEmpAbove) / 100, employerRate: Number(socEr) / 100 },
        medicalInsurance: current.medicalInsurance,
        unemploymentInsurance: current.unemploymentInsurance,
        notes: notes.trim() || `Versiya ${effectiveFrom} — istifadəçi tərəfindən əlavə edildi`,
      };
      await saveTaxConfig(cfg);
      toast.success(tt('Yeni vergi konfiqurasiyası əlavə edildi', 'New tax configuration added'), `${tt('Qüvvəyə minmə:', 'Effective from:')} ${effectiveFrom}`);
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{tt('Vergi/sığorta konfiqurasiyası — yeni versiya', 'Tax/insurance configuration — new version')}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">{tt('Dəyərlər sərt kodlaşdırılmır. Yeni versiya əlavə edildikdə keçmiş dövrlər öz tarixi konfiqurasiyası ilə hesablanır. Rəqəmlər taxes.gov.az / DSMF-dən təsdiqlənməlidir.', 'Values are not hardcoded. When a new version is added, past periods are calculated with their own historical configuration. Figures must be confirmed from taxes.gov.az / SSPF.')}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>{tt('Qüvvəyə minmə', 'Effective from')}</Label><Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Minimum əmək haqqı', 'Minimum wage')}</Label><Input type="number" value={minimumWage} onChange={(e) => setMinimumWage(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Gəlir vergisi həddi (₼)', 'Income tax threshold (₼)')}</Label><Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Aşağı dərəcə (%)', 'Lower rate (%)')}</Label><Input type="number" value={incomeLow} onChange={(e) => setIncomeLow(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Yuxarı dərəcə (%)', 'Upper rate (%)')}</Label><Input type="number" value={incomeHigh} onChange={(e) => setIncomeHigh(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Sosial (işçi ≤200 ₼) %', 'Social (employee ≤200 ₼) %')}</Label><Input type="number" value={socEmpBase} onChange={(e) => setSocEmpBase(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Sosial (işçi >200 ₼) %', 'Social (employee >200 ₼) %')}</Label><Input type="number" value={socEmpAbove} onChange={(e) => setSocEmpAbove(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Sosial (işəgötürən) %', 'Social (employer) %')}</Label><Input type="number" value={socEr} onChange={(e) => setSocEr(e.target.value)} /></div>
          <div className="col-span-2 space-y-2"><Label>{tt('Qeyd / mənbə', 'Note / source')}</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tt('DSMF elanı tarixi və s.', 'SSPF announcement date, etc.')} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Versiyanı əlavə et', 'Add version')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
