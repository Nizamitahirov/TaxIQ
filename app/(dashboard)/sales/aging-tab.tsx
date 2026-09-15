'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { listInvoices, computeAging } from '@/lib/firebase/sales';
import { Card, CardContent } from '@/components/ui/card';
import { ExportButton } from '@/components/shared/export-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils/format';
import { useTT } from '@/lib/i18n/tt';

export function AgingTab({ companyId, baseCurrency }: { companyId: string; baseCurrency: string }) {
  const tt = useTT();
  const { data, isLoading } = useQuery({
    queryKey: ['aging', companyId],
    queryFn: async () => computeAging(await listInvoices(companyId)),
  });

  if (isLoading || !data) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tt('Ödəniş müddətinə görə açıq fakturalar (06 §8)', 'Open invoices by payment term (06 §8)')}</p>
        <ExportButton filename="debitor-yas-analizi" rows={data.rows}
          columns={[
            { header: tt('Müştəri', 'Customer'), value: 'customerName' }, { header: '0-30', value: 'b0_30' },
            { header: '31-60', value: 'b31_60' }, { header: '61-90', value: 'b61_90' },
            { header: '90+', value: 'b90' }, { header: tt('Ümumi', 'Total'), value: 'total' },
          ]} />
      </div>
      <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{tt('Müştəri', 'Customer')}</TableHead>
            <TableHead className="text-right">0-30 {tt('gün', 'days')}</TableHead><TableHead className="text-right">31-60</TableHead>
            <TableHead className="text-right">61-90</TableHead><TableHead className="text-right">90+</TableHead>
            <TableHead className="text-right">{tt('Ümumi', 'Total')}</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{tt('Açıq debitor borcu yoxdur', 'No open receivables')}</TableCell></TableRow>
            ) : data.rows.map((r) => (
              <TableRow key={r.customerId}>
                <TableCell className="font-medium">{r.customerName}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(r.b0_30, baseCurrency)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(r.b31_60, baseCurrency)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(r.b61_90, baseCurrency)}</TableCell>
                <TableCell className="text-right tnum text-danger">{formatCurrency(r.b90, baseCurrency)}</TableCell>
                <TableCell className="text-right font-semibold tnum">{formatCurrency(r.total, baseCurrency)}</TableCell>
              </TableRow>
            ))}
            {data.rows.length > 0 && (
              <TableRow className="border-t-2 font-bold">
                <TableCell>{tt('CƏMİ', 'TOTAL')}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(data.totals.b0_30, baseCurrency)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(data.totals.b31_60, baseCurrency)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(data.totals.b61_90, baseCurrency)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(data.totals.b90, baseCurrency)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(data.totals.total, baseCurrency)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
