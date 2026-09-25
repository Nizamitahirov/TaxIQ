'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Landmark, Receipt, Users2, TrendingUp, Download, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listInvoices } from '@/lib/firebase/sales';
import { listPurchaseBills } from '@/lib/firebase/treasury';
import { listPayrollRuns } from '@/lib/firebase/hr';
import { generateProfitLoss, yearPeriod } from '@/lib/ifrs/engine';
import {
  computeVat, computeWithholding, computeProfitTax, PROFIT_TAX_RATE, VAT_RATE, type TaxPeriod,
} from '@/lib/tax/declarations';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { exportToExcel } from '@/lib/utils/export';
import { formatCurrency } from '@/lib/utils/format';

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun', 'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'];

export default function TaxPage() {
  const tt = useTT();
  const { active, isSuperAdmin, can } = useAuth();
  const companyId = active?.companyId;
  const cur = active?.company.baseCurrency ?? 'AZN';
  const canView = isSuperAdmin || can('reports.view') || can('accounting.coa.view');

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [mode, setMode] = useState<'month' | 'quarter'>('month');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const period: TaxPeriod = mode === 'month' ? { year, month } : { year, quarter };
  const periodLabel = mode === 'month' ? `${MONTHS[month - 1]} ${year}` : `${quarter}-ci rüb ${year}`;

  const { data: invoices } = useQuery({ queryKey: ['invoices', companyId], queryFn: () => listInvoices(companyId!), enabled: canView && !!companyId });
  const { data: bills } = useQuery({ queryKey: ['purchaseBills', companyId], queryFn: () => listPurchaseBills(companyId!), enabled: canView && !!companyId });
  const { data: runs } = useQuery({ queryKey: ['payrollRuns', companyId], queryFn: () => listPayrollRuns(companyId!), enabled: canView && !!companyId });
  const { data: pnl } = useQuery({
    queryKey: ['pnl-tax', companyId, year],
    queryFn: () => generateProfitLoss(companyId!, yearPeriod(year), yearPeriod(year - 1)),
    enabled: canView && !!companyId,
  });

  const vat = useMemo(() => computeVat(invoices ?? [], bills ?? [], period), [invoices, bills, period]);
  const wh = useMemo(() => computeWithholding(runs ?? [], period), [runs, period]);
  const netProfit = useMemo(() => {
    const rows = pnl?.rows ?? [];
    const line = rows.find((l) => l.label.toLocaleLowerCase('az').includes('xalis'));
    return line?.current ?? 0;
  }, [pnl]);
  const profitTax = useMemo(() => computeProfitTax(netProfit), [netProfit]);

  if (!companyId) return <div><PageHeader title={tt('Vergi bəyannamələri', 'Tax returns')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('Vergi bəyannamələri', 'Tax returns')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader
        title={tt('Vergi bəyannamələri', 'Tax returns')}
        subtitle={tt('ƏDV, ödəmə mənbəyində vergi və mənfəət vergisi — real sistem datasından', 'VAT, withholding and profit tax — from real system data')}
        action={
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">{tt('İl', 'Year')}</Label>
              <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}><SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">{tt('Dövr', 'Period')}</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as 'month' | 'quarter')}><SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="month">{tt('Aylıq', 'Monthly')}</SelectItem><SelectItem value="quarter">{tt('Rüblük', 'Quarterly')}</SelectItem></SelectContent></Select>
            </div>
            {mode === 'month' ? (
              <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">{tt('Ay', 'Month')}</Label>
                <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}><SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select>
              </div>
            ) : (
              <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">{tt('Rüb', 'Quarter')}</Label>
                <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}><SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>{[1, 2, 3, 4].map((q) => <SelectItem key={q} value={String(q)}>{tt(`${q}-ci rüb`, `Q${q}`)}</SelectItem>)}</SelectContent></Select>
              </div>
            )}
          </div>
        }
      />

      {/* Xülasə kartları */}
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <SummaryCard icon={Receipt} tint="from-indigo-500 to-violet-500" title={tt('ƏDV (18%)', 'VAT (18%)')} value={formatCurrency(vat.payable, cur)}
          sub={tt(`Çıxış ${formatCurrency(vat.outputVat, cur)} − Giriş ${formatCurrency(vat.inputVat, cur)}`, `Output ${formatCurrency(vat.outputVat, cur)} − Input ${formatCurrency(vat.inputVat, cur)}`)}
          note={vat.payable >= 0 ? tt('ödəniləcək', 'payable') : tt('əvəzləşdirmə', 'creditable')} />
        <SummaryCard icon={Users2} tint="from-amber-500 to-orange-500" title={tt('Ödəmə mənbəyində vergi', 'Withholding tax')} value={formatCurrency(wh.incomeTax, cur)}
          sub={tt(`Gross ${formatCurrency(wh.gross, cur)} · ${wh.lines.length} işçi`, `Gross ${formatCurrency(wh.gross, cur)} · ${wh.lines.length} employees`)}
          note={tt('gəlir vergisi', 'income tax')} />
        <SummaryCard icon={TrendingUp} tint="from-emerald-500 to-teal-500" title={tt('Mənfəət vergisi (20%)', 'Profit tax (20%)')} value={formatCurrency(profitTax.tax, cur)}
          sub={tt(`Mənfəət ${formatCurrency(profitTax.profit, cur)} · illik`, `Profit ${formatCurrency(profitTax.profit, cur)} · annual`)}
          note={`${year}`} />
      </div>

      {/* ƏDV detalları */}
      <DeclCard title={tt(`ƏDV bəyannaməsi — ${periodLabel}`, `VAT return — ${periodLabel}`)}
        onExport={() => exportToExcel('EDV-beyannamesi', [
          { header: tt('Növ', 'Type'), value: 'kind' }, { header: tt('Tarix', 'Date'), value: 'date' }, { header: tt('Sənəd', 'Doc'), value: 'number' },
          { header: tt('Tərəf', 'Party'), value: 'party' }, { header: tt('Baza', 'Base'), value: 'base' }, { header: tt('ƏDV', 'VAT'), value: 'vat' },
        ], [
          ...vat.sales.map((s) => ({ kind: tt('Satış', 'Sale'), ...s })),
          ...vat.purchases.map((p) => ({ kind: tt('Alış', 'Purchase'), ...p })),
        ])}>
        <div className="grid gap-4 lg:grid-cols-2">
          <MiniTable title={tt('Satışlar (çıxış ƏDV)', 'Sales (output VAT)')} rows={vat.sales} cur={cur} total={vat.outputVat} tt={tt} />
          <MiniTable title={tt('Alışlar (giriş ƏDV)', 'Purchases (input VAT)')} rows={vat.purchases} cur={cur} total={vat.inputVat} tt={tt} />
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium">{tt('Ödəniləcək ƏDV (çıxış − giriş)', 'VAT payable (output − input)')}</span>
          <span className="text-lg font-bold text-primary">{formatCurrency(vat.payable, cur)}</span>
        </div>
      </DeclCard>

      {/* Ödəmə mənbəyində vergi detalları */}
      <DeclCard title={tt(`Ödəmə mənbəyində vergi — ${periodLabel}`, `Withholding — ${periodLabel}`)}
        onExport={() => exportToExcel('Odeme-menbeyinde-vergi', [
          { header: tt('İşçi', 'Employee'), value: 'employee' }, { header: 'Gross', value: 'gross' },
          { header: tt('Gəlir vergisi', 'Income tax'), value: 'incomeTax' }, { header: tt('Pensiya', 'Pension'), value: 'social' },
          { header: tt('İşsizlik', 'Unemployment'), value: 'unemployment' }, { header: tt('Tibbi', 'Medical'), value: 'medical' },
        ], wh.lines)}>
        {wh.lines.length === 0 ? <EmptyState title={tt('Bu dövrdə əmək haqqı yoxdur', 'No payroll this period')} /> : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table><TableHeader><TableRow>
              <TableHead>{tt('İşçi', 'Employee')}</TableHead><TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">{tt('Gəlir vergisi', 'Income tax')}</TableHead><TableHead className="text-right">{tt('Pensiya', 'Pension')}</TableHead>
              <TableHead className="text-right">{tt('İşsizlik', 'Unempl.')}</TableHead><TableHead className="text-right">{tt('Tibbi', 'Medical')}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {wh.lines.map((l, i) => <TableRow key={i}>
                <TableCell className="font-medium">{l.employee}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(l.gross, cur)}</TableCell>
                <TableCell className="text-right tnum font-semibold text-primary">{formatCurrency(l.incomeTax, cur)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(l.social, cur)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(l.unemployment, cur)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(l.medical, cur)}</TableCell>
              </TableRow>)}
              <TableRow className="border-t-2 font-bold">
                <TableCell>{tt('Cəmi', 'Total')}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(wh.gross, cur)}</TableCell>
                <TableCell className="text-right tnum text-primary">{formatCurrency(wh.incomeTax, cur)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(wh.social, cur)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(wh.unemployment, cur)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(wh.medical, cur)}</TableCell>
              </TableRow>
            </TableBody></Table>
          </div>
        )}
      </DeclCard>

      {/* Mənfəət vergisi */}
      <DeclCard title={tt(`Mənfəət vergisi — ${year}`, `Profit tax — ${year}`)} onExport={() => exportToExcel('Menfeet-vergisi', [
        { header: tt('Göstərici', 'Item'), value: 'k' }, { header: tt('Məbləğ', 'Amount'), value: 'v' },
      ], [
        { k: tt('Vergiyə cəlb olunan mənfəət', 'Taxable profit'), v: profitTax.profit },
        { k: tt('Dərəcə', 'Rate'), v: `${PROFIT_TAX_RATE * 100}%` },
        { k: tt('Mənfəət vergisi', 'Profit tax'), v: profitTax.tax },
      ])}>
        <div className="grid gap-3 sm:grid-cols-3">
          <KV label={tt('Vergiyə cəlb olunan mənfəət (illik P&L)', 'Taxable profit (annual P&L)')} value={formatCurrency(profitTax.profit, cur)} />
          <KV label={tt('Dərəcə', 'Rate')} value={`${PROFIT_TAX_RATE * 100}%`} />
          <KV label={tt('Hesablanmış vergi', 'Computed tax')} value={formatCurrency(profitTax.tax, cur)} primary />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{tt('Qeyd: mənfəət vergisi illik əsasda hesablanır (IFRS Mənfəət-Zərər hesabatından). Rüblük avanslar mənfəətin nisbətinə görə tənzimlənir.', 'Note: profit tax is computed annually (from the IFRS P&L). Quarterly advances are adjusted pro-rata.')}</p>
      </DeclCard>

      <p className="mt-4 text-xs text-muted-foreground">
        {tt('Bu bəyannamələr sistemdəki fakturalar, alışlar və əmək haqqı əsasında hesablanır. e-taxes.gov.az formatına ixrac və birbaşa göndərmə növbəti mərhələdədir.', 'These returns are computed from the system’s invoices, purchases and payroll. e-taxes.gov.az export and direct submission are on the roadmap.')}
      </p>
    </div>
  );
}

function SummaryCard({ icon: Icon, tint, title, value, sub, note }: { icon: typeof Receipt; tint: string; title: string; value: string; sub: string; note: string }) {
  return (
    <Card className="rounded-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <span className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${tint} text-white shadow-soft`}><Icon className="h-5 w-5" /></span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{note}</span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{title}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function DeclCard({ title, onExport, children }: { title: string; onExport: () => void; children: React.ReactNode }) {
  const tt = useTT();
  return (
    <Card className="mb-4 rounded-card">
      <CardContent className="p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" /><h3 className="font-semibold">{title}</h3></div>
          <Button size="sm" variant="outline" onClick={onExport}><Download className="h-4 w-4" /> {tt('Excel', 'Excel')}</Button>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function MiniTable({ title, rows, cur, total, tt }: { title: string; rows: { date: string; number: string; party: string; base: number; vat: number }[]; cur: string; total: number; tt: (a: string, b: string) => string }) {
  return (
    <div className="rounded-lg border border-border">
      <div className="border-b border-border bg-secondary/40 px-3 py-2 text-xs font-semibold text-muted-foreground">{title}</div>
      {rows.length === 0 ? <p className="px-3 py-6 text-center text-xs text-muted-foreground">{tt('Qeyd yoxdur', 'No records')}</p> : (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-xs">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-1.5 text-muted-foreground">{r.date}</td>
                  <td className="truncate px-2 py-1.5 font-medium">{r.party}</td>
                  <td className="px-2 py-1.5 text-right tnum text-muted-foreground">{formatCurrency(r.base, cur)}</td>
                  <td className="px-3 py-1.5 text-right tnum font-semibold">{formatCurrency(r.vat, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm"><span className="font-medium">{tt('Cəmi ƏDV', 'Total VAT')}</span><span className="font-bold text-primary">{formatCurrency(total, cur)}</span></div>
    </div>
  );
}

function KV({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-bold ${primary ? 'text-primary' : ''}`}>{value}</p>
    </div>
  );
}
