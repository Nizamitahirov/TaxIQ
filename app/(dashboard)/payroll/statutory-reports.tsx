'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, FileSpreadsheet, Eye, Download, Landmark } from 'lucide-react';
import { listEmployees, listPayrollRuns, listLeaveRequests, listLeaveBalances, listMonthlyTimesheets, listBusinessTrips, getActiveTaxConfig } from '@/lib/firebase/hr';
import { listExchangeRates } from '@/lib/firebase/treasury';
import {
  STATUTORY_REPORTS, downloadBlob, type ReportContext, type GeneratedReport, type StatutoryReportKey,
} from '@/lib/reports/statutory';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import type { Company } from '@/types';

const MONTHS_AZ = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];

export function StatutoryReportsPanel({ companyId, company, canView }: { companyId: string; company: Company; canView: boolean }) {
  const tt = useTT();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [busyKey, setBusyKey] = useState<StatutoryReportKey | null>(null);
  const [result, setResult] = useState<GeneratedReport | null>(null);

  const { data: employees } = useQuery({ queryKey: ['employees', companyId], queryFn: () => listEmployees(companyId), enabled: canView });
  const { data: runs } = useQuery({ queryKey: ['payrollRuns', companyId], queryFn: () => listPayrollRuns(companyId), enabled: canView });
  const { data: leave } = useQuery({ queryKey: ['leaveRequests', companyId], queryFn: () => listLeaveRequests(companyId), enabled: canView });
  const { data: balances } = useQuery({ queryKey: ['leaveBalances', companyId], queryFn: () => listLeaveBalances(companyId), enabled: canView });
  const { data: timesheets } = useQuery({ queryKey: ['monthlyTimesheets', companyId], queryFn: () => listMonthlyTimesheets(companyId), enabled: canView });
  const { data: trips } = useQuery({ queryKey: ['businessTrips', companyId], queryFn: () => listBusinessTrips(companyId), enabled: canView });
  const { data: rates } = useQuery({ queryKey: ['exchangeRates', companyId], queryFn: () => listExchangeRates(companyId), enabled: canView });
  const { data: cfg } = useQuery({ queryKey: ['taxcfg'], queryFn: getActiveTaxConfig, enabled: canView });

  const ready = !!employees && !!runs && !!leave && !!cfg && !!balances && !!timesheets && !!trips && !!rates;
  const years = useMemo(() => Array.from({ length: 5 }, (_, i) => now.getFullYear() - i), [now]);

  async function run(key: StatutoryReportKey) {
    if (!ready) { toast.error(tt('Məlumat yüklənir…', 'Loading data…')); return; }
    const def = STATUTORY_REPORTS.find((r) => r.key === key)!;
    const ctx: ReportContext = { company, employees: employees!, runs: runs!, leaveRequests: leave!, leaveBalances: balances!, timesheets: timesheets!, businessTrips: trips!, rates: rates!, cfg: cfg!, year, quarter, month };
    setBusyKey(key);
    try {
      const gen = await def.gen(ctx);
      setResult(gen);
    } catch (e) { toast.error(tt('Yaradıla bilmədi', 'Could not generate'), e instanceof Error ? e.message : undefined); }
    finally { setBusyKey(null); }
  }

  if (!canView) return null;

  return (
    <Card className="mt-6 rounded-card">
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><Landmark className="h-5 w-5" /></span>
            <div>
              <p className="font-semibold">{tt('Rəsmi hesabatlar (DSMF/ASAN)', 'Statutory reports (DSMF)')}</p>
              <p className="text-xs text-muted-foreground">{tt('Real sistem datası ilə doldurulmuş şablonlar — önizlə və yüklə', 'Templates filled with real system data — preview and download')}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">{tt('İl', 'Year')}</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}><SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">{tt('Ay (cədvəl)', 'Month (table)')}</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}><SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS_AZ.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">{tt('Rüb (DSMF)', 'Quarter (DSMF)')}</Label>
              <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}><SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)}>{tt(`${q}-ci rüb`, `Q${q}`)}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STATUTORY_REPORTS.map((r) => (
            <div key={r.key} className="flex flex-col rounded-card border border-border p-4">
              <div className="flex items-start gap-2">
                <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug">{tt(r.az, r.en)}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.desc}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">{r.periodic === 'month' ? `${MONTHS_AZ[month - 1]} ${year}` : `${quarter}-ci rüb ${year}`}</span>
                <Button size="sm" variant="outline" className="h-8" disabled={!ready || busyKey === r.key} onClick={() => run(r.key)}>
                  {busyKey === r.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} {tt('Önizlə', 'Preview')}
                </Button>
              </div>
            </div>
          ))}
        </div>
        {!ready && <p className="mt-3 text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" /> {tt('Məlumat yüklənir…', 'Loading data…')}</p>}
      </CardContent>

      <PreviewDialog result={result} onClose={() => setResult(null)} />
    </Card>
  );
}

function PreviewDialog({ result, onClose }: { result: GeneratedReport | null; onClose: () => void }) {
  const tt = useTT();
  if (!result) return null;
  const p = result.preview;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex h-[86vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0"><p className="truncate text-sm font-semibold">{p.title}</p><p className="truncate text-xs text-muted-foreground">{tt('Önizləmə — yükləmədən əvvəl', 'Preview — before download')}</p></div>
          <Button size="sm" onClick={() => downloadBlob(result.blob, result.filename)}><Download className="h-4 w-4" /> {tt('Yüklə (.xlsx)', 'Download (.xlsx)')}</Button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {p.note && <p className="mb-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-foreground">{p.note}</p>}
          {p.rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{tt('Bu dövr üçün məlumat yoxdur — boş şablon yüklənəcək.', 'No data for this period — an empty template will be downloaded.')}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead><tr className="bg-secondary/60">{p.columns.map((c, i) => <th key={i} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{c}</th>)}</tr></thead>
                <tbody>
                  {p.rows.map((row, i) => (
                    <tr key={i} className="border-t border-border">
                      {row.map((cell, j) => <td key={j} className="whitespace-nowrap px-3 py-1.5 tnum">{typeof cell === 'number' ? cell.toLocaleString('az-AZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">{tt('Qeyd: yüklənən .xlsx faylı rəsmi şablonun strukturunu (başlıqlar, birləşmələr, kodlar) olduğu kimi saxlayır; yalnız data xanaları doldurulur.', 'Note: the downloaded .xlsx preserves the official template structure (headers, merges, codes); only data cells are filled.')}</p>
        </div>
        <DialogFooter className="border-t border-border px-5 py-3">
          <Button variant="outline" onClick={onClose}>{tt('Bağla', 'Close')}</Button>
          <Button onClick={() => downloadBlob(result.blob, result.filename)}><Download className="h-4 w-4" /> {tt('Yüklə', 'Download')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
