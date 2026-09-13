'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Check, Banknote, FileText, Printer, Info, SlidersHorizontal, Settings2, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  listPayrollRuns, calculatePayrollRun, approvePayrollRun, markPayrollPaid, getActiveTaxConfig,
  listEmployees, listPayrollAdjustments, savePayrollAdjustment, saveTaxConfig,
} from '@/lib/firebase/hr';
import { DEFAULT_TAX_CONFIG } from '@/lib/payroll/tax';
import { exportToCsv, exportToExcel } from '@/lib/utils/export';
import { PageHeader } from '@/components/shared/page-header';
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

export default function PayrollPage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
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

  if (!companyId) return <div><PageHeader title="Əmək haqqı" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Aktiv şirkət seçin.</CardContent></Card></div>;
  if (!canView) return <div><PageHeader title="Əmək haqqı" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">İcazə yoxdur.</CardContent></Card></div>;

  const now = new Date();
  function invalidate() { qc.invalidateQueries({ queryKey: ['payrollRuns', companyId] }); qc.invalidateQueries({ queryKey: ['journal', companyId] }); }

  async function run() {
    setBusy(true);
    try { await calculatePayrollRun(companyId!, now.getMonth() + 1, now.getFullYear(), profile?.uid ?? ''); toast.success('Dövr hesablandı', 'Aylıq düzəlişlər (overtime/bonus/kəsinti) daxil edildi'); invalidate(); }
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
      exportToCsv(`emek-haqqi-${r.periodYear}-${r.periodMonth}`, [
        { header: 'İşçi', value: 'employeeName' }, { header: 'Net məbləğ', value: 'netSalary' },
      ], r.lines);
      toast.success('Ödənildi kimi işarələndi', 'Bank toplu faylı (CSV) yükləndi');
      invalidate();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }
  function taxDeclaration(r: PayrollRun) {
    // Dövlət Vergi Xidməti / DSMF bəyannaməsi strukturu (10 §8)
    exportToExcel(`vergi-beyannamesi-${r.periodYear}-${r.periodMonth}`, [
      { header: 'İşçi', value: 'employeeName' }, { header: 'Gross', value: 'grossSalary' },
      { header: 'Gəlir vergisi', value: 'incomeTax' },
      { header: 'İşçi sosial (DSMF)', value: 'employeeSocialInsurance' }, { header: 'İşəgötürən sosial (DSMF)', value: 'employerSocialInsurance' },
      { header: 'İşçi tibbi', value: 'employeeMedicalInsurance' }, { header: 'İşəgötürən tibbi', value: 'employerMedicalInsurance' },
      { header: 'İşçi işsizlik', value: 'employeeUnemploymentInsurance' }, { header: 'İşəgötürən işsizlik', value: 'employerUnemploymentInsurance' },
      { header: 'Net', value: 'netSalary' },
    ], r.lines, 'Bəyannamə');
    toast.success('Vergi/DSMF bəyannaməsi ixrac edildi', 'Rəsmi portala əl ilə yükləyin');
  }

  return (
    <div>
      <PageHeader title="Əmək haqqı" subtitle={`${active?.company.name} · payroll (Modul 10)`}
        action={<div className="flex flex-wrap items-center gap-2">
          {canRun && <Button variant="outline" size="sm" onClick={() => setAdjOpen(true)}><SlidersHorizontal className="h-4 w-4" /> Düzəlişlər</Button>}
          {canApprove && <Button variant="outline" size="sm" onClick={() => setCfgOpen(true)}><Settings2 className="h-4 w-4" /> Vergi konfiqurasiyası</Button>}
          {canRun && <Button onClick={run} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {MONTHS[now.getMonth()]} {now.getFullYear()} hesabla</Button>}
        </div>} />

      <div className="mb-4 flex items-start gap-2 rounded-card border border-info/20 bg-info/5 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        Vergi/sığorta dərəcələri versiyalanan konfiqurasiyadan götürülür (sərt kodlaşdırma yoxdur). Aktiv versiya: <span className="font-medium">{taxCfg?.effectiveFrom ?? '—'}</span>. {taxCfg?.notes}
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Əmək haqqı dövrü yoxdur" description="Aktiv işçilər üçün yuxarıdakı düymə ilə dövr hesablayın." />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Dövr</TableHead><TableHead>İşçi</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Net</TableHead><TableHead className="text-right">Super-gross</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
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
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Vergi/DSMF bəyannaməsi" onClick={() => taxDeclaration(r)}><FileSpreadsheet className="h-4 w-4" /></Button>
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
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>{detail && `${MONTHS[detail.periodMonth - 1]} ${detail.periodYear}`} — detallar (net / gross / super-gross)</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3">
              <div className="flex justify-end"><ExportButton filename={`payroll-${detail.periodYear}-${detail.periodMonth}`} rows={detail.lines}
                columns={[
                  { header: 'İşçi', value: 'employeeName' }, { header: 'Baza', value: 'baseSalary' }, { header: 'Overtime', value: 'overtimePay' }, { header: 'Bonus', value: 'bonuses' },
                  { header: 'Gross', value: 'grossSalary' }, { header: 'Gəlir vergisi', value: 'incomeTax' }, { header: 'Sosial', value: 'employeeSocialInsurance' },
                  { header: 'Tibbi', value: 'employeeMedicalInsurance' }, { header: 'İşsizlik', value: 'employeeUnemploymentInsurance' }, { header: 'Kəsinti', value: 'otherDeductions' },
                  { header: 'Net', value: 'netSalary' }, { header: 'Super-gross', value: 'totalEmployerCost' },
                ]} /></div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>İşçi</TableHead><TableHead className="text-right">Baza</TableHead><TableHead className="text-right">OT/Bonus</TableHead><TableHead className="text-right">Gross</TableHead><TableHead className="text-right">Gəlir v.</TableHead><TableHead className="text-right">Sosial</TableHead><TableHead className="text-right">Tibbi</TableHead><TableHead className="text-right">İşsizlik</TableHead><TableHead className="text-right">Net</TableHead><TableHead className="text-right">Super-gross</TableHead></TableRow></TableHeader>
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
                        <TableCell className="text-right tnum text-muted-foreground">{formatCurrency(l.totalEmployerCost, base)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground"><b>Net</b> = işçiyə ödənilən · <b>Gross</b> = vergi/sığortadan əvvəl · <b>Super-gross</b> = gross + işəgötürənin sosial/tibbi/işsizlik öhdəlikləri (tam əmək xərci).</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {adjOpen && <AdjustmentsDialog companyId={companyId} year={now.getFullYear()} month={now.getMonth() + 1} base={base} onClose={() => setAdjOpen(false)} />}
      {cfgOpen && <TaxConfigDialog current={taxCfg ?? DEFAULT_TAX_CONFIG} onClose={() => setCfgOpen(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['taxcfg'] })} />}
    </div>
  );
}

/** Aylıq overtime / bonus / kəsinti düzəlişləri (hesablamadan əvvəl) */
function AdjustmentsDialog({ companyId, year, month, base, onClose }: { companyId: string; year: number; month: number; base: string; onClose: () => void }) {
  const qc = useQueryClient();
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
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusyId(null); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{MONTHS[month - 1]} {year} — aylıq düzəlişlər ({base})</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Bu dəyərlər növbəti hesablamada gross-a (overtime + bonus) və net-dən (kəsinti) tətbiq olunur.</p>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>İşçi</TableHead><TableHead className="text-right">Overtime</TableHead><TableHead className="text-right">Bonus</TableHead><TableHead className="text-right">Kəsinti</TableHead></TableRow></TableHeader>
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
        <DialogFooter><Button variant="outline" onClick={onClose}>Bağla</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Versiyalanan vergi konfiqurasiyası — yeni versiya əlavə et (10 §6.1) */
function TaxConfigDialog({ current, onClose, onSaved }: { current: PayrollTaxConfig; onClose: () => void; onSaved: () => void }) {
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
      toast.success('Yeni vergi konfiqurasiyası əlavə edildi', `Qüvvəyə minmə: ${effectiveFrom}`);
      onSaved(); onClose();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Vergi/sığorta konfiqurasiyası — yeni versiya</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Dəyərlər sərt kodlaşdırılmır. Yeni versiya əlavə edildikdə keçmiş dövrlər öz tarixi konfiqurasiyası ilə hesablanır. Rəqəmlər taxes.gov.az / DSMF-dən təsdiqlənməlidir.</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>Qüvvəyə minmə</Label><Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} /></div>
          <div className="space-y-2"><Label>Minimum əmək haqqı</Label><Input type="number" value={minimumWage} onChange={(e) => setMinimumWage(e.target.value)} /></div>
          <div className="space-y-2"><Label>Gəlir vergisi həddi (₼)</Label><Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></div>
          <div className="space-y-2"><Label>Aşağı dərəcə (%)</Label><Input type="number" value={incomeLow} onChange={(e) => setIncomeLow(e.target.value)} /></div>
          <div className="space-y-2"><Label>Yuxarı dərəcə (%)</Label><Input type="number" value={incomeHigh} onChange={(e) => setIncomeHigh(e.target.value)} /></div>
          <div className="space-y-2"><Label>Sosial (işçi ≤200 ₼) %</Label><Input type="number" value={socEmpBase} onChange={(e) => setSocEmpBase(e.target.value)} /></div>
          <div className="space-y-2"><Label>Sosial (işçi &gt;200 ₼) %</Label><Input type="number" value={socEmpAbove} onChange={(e) => setSocEmpAbove(e.target.value)} /></div>
          <div className="space-y-2"><Label>Sosial (işəgötürən) %</Label><Input type="number" value={socEr} onChange={(e) => setSocEr(e.target.value)} /></div>
          <div className="col-span-2 space-y-2"><Label>Qeyd / mənbə</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="DSMF elanı tarixi və s." /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Versiyanı əlavə et</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
