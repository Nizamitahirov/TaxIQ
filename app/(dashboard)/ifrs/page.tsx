'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle2, AlertTriangle, FileBarChart } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  generateBalanceSheet, generateProfitLoss, generateCashFlow, generateEquityChanges,
  yearPeriod, type FinancialStatement,
} from '@/lib/ifrs/engine';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { ExportButton } from '@/components/shared/export-button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

type StatementType = 'balance_sheet' | 'profit_loss' | 'cash_flow' | 'equity_changes';
const TYPES: { value: StatementType; label: string }[] = [
  { value: 'balance_sheet', label: 'Maliyyə Vəziyyəti (Balans)' },
  { value: 'profit_loss', label: 'Mənfəət və Zərər' },
  { value: 'cash_flow', label: 'Pul Vəsaitlərinin Hərəkəti' },
  { value: 'equity_changes', label: 'Kapitalda Dəyişikliklər' },
];

export default function IfrsPage() {
  const { active, can, isSuperAdmin } = useAuth();
  const companyId = active?.companyId;
  const allowed = isSuperAdmin || can('accounting.reports.ifrs.view');
  const nowYear = new Date().getFullYear();
  const [type, setType] = useState<StatementType>('balance_sheet');
  const [year, setYear] = useState(nowYear);

  const { data, isLoading } = useQuery({
    queryKey: ['ifrs', companyId, type, year],
    queryFn: async (): Promise<FinancialStatement> => {
      const cur = yearPeriod(year);
      const prior = yearPeriod(year - 1);
      if (type === 'balance_sheet') return generateBalanceSheet(companyId!, cur, prior);
      if (type === 'profit_loss') return generateProfitLoss(companyId!, cur, prior);
      if (type === 'cash_flow') return generateCashFlow(companyId!, cur, prior);
      return generateEquityChanges(companyId!, cur);
    },
    enabled: !!companyId && allowed,
  });

  if (!companyId) return <div><PageHeader title="IFRS Hesabatlar" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Aktiv şirkət seçin.</CardContent></Card></div>;
  if (!allowed) return <div><PageHeader title="IFRS Hesabatlar" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">İcazə yoxdur (accounting.reports.ifrs.view).</CardContent></Card></div>;

  const base = active?.company.baseCurrency ?? 'AZN';
  const showComparison = type === 'balance_sheet' || type === 'profit_loss';

  return (
    <div>
      <PageHeader
        title="IFRS Maliyyə Hesabatları"
        subtitle={`${active?.company.name} · IAS 1 (Modul 9) · Modul 8 qalıqlarından avtomatik`}
        action={data && (
          <ExportButton filename={`ifrs-${type}-${year}`} rows={data.rows}
            columns={[
              { header: 'Maddə', value: 'label' },
              { header: `Cari (${year})`, value: 'current' },
              ...(showComparison ? [{ header: `Əvvəlki (${year - 1})`, value: 'prior' as const }] : []),
            ]} />
        )}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={type} onValueChange={(v) => setType(v as StatementType)}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>{[0, 1, 2, 3].map((i) => <SelectItem key={i} value={String(nowYear - i)}>{nowYear - i}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <Card className="rounded-card">
          <CardContent className="p-0">
            <div className="border-b border-border p-5 text-center">
              <FileBarChart className="mx-auto mb-2 h-6 w-6 text-primary" />
              <p className="text-lg font-bold">{data.title}</p>
              <p className="text-sm text-muted-foreground">{active?.company.name} · VÖEN {active?.company.taxId || '—'} · {data.periodLabel} · {base}</p>
            </div>

            {data.balanced !== undefined && (
              <div className={cn('flex items-center gap-2 px-5 py-2 text-sm font-medium', data.balanced ? 'text-success' : 'text-danger')}>
                {data.balanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {data.balanced ? 'Balans tənliyi doğrulandı (Aktivlər = Kapital + Öhdəliklər)' : data.warning}
              </div>
            )}
            {data.warning && data.balanced === undefined && (
              <div className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-danger"><AlertTriangle className="h-4 w-4" /> {data.warning}</div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2 text-left">Maddə</th>
                    <th className="px-5 py-2 text-right">Cari ({year})</th>
                    {showComparison && <th className="px-5 py-2 text-right">Əvvəlki ({year - 1})</th>}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => {
                    const isHeader = r.current === 0 && r.prior === 0 && r.bold && !r.subtotal;
                    return (
                      <tr key={i} className={cn('border-b border-border/30', r.subtotal && 'border-t border-border bg-secondary/30')}>
                        <td className={cn('px-5 py-1.5', r.bold && 'font-bold', r.level > 0 && 'pl-10')}>{r.label}</td>
                        <td className={cn('px-5 py-1.5 text-right tnum', r.bold && 'font-bold')}>{isHeader ? '' : formatCurrency(r.current, base)}</td>
                        {showComparison && <td className={cn('px-5 py-1.5 text-right tnum text-muted-foreground', r.bold && 'font-bold')}>{isHeader ? '' : formatCurrency(r.prior, base)}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-5 py-3 text-xs text-muted-foreground">Qeyd: Cash Flow (dolayı metod) və Kapital dəyişiklikləri dövr açılış/bağlanış qalıqlarından hesablanır. IFRS 18 (2027) keçidi üçün struktur template-əsaslıdır (09 §1).</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
