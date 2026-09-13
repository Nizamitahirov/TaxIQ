'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { computeTrialBalance } from '@/lib/firebase/accounting';
import { Card, CardContent } from '@/components/ui/card';
import { ExportButton } from '@/components/shared/export-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

export function TrialBalanceTab({ companyId }: { companyId: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['trial', companyId], queryFn: () => computeTrialBalance(companyId) });

  if (isLoading || !data) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const balanced = Math.abs(data.totalDebit - data.totalCredit) < 0.005;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className={cn('flex items-center gap-2 rounded-card border px-3 py-1.5 text-sm font-medium', balanced ? 'border-success/40 bg-success/10' : 'border-danger/40 bg-danger/10')}>
          {balanced ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-danger" />}
          {balanced ? 'Balanslaşdırılıb (Dt = Kt)' : 'XƏBƏRDARLIQ: Dt ≠ Kt'}
        </div>
        <ExportButton filename="yoxlama-balansi" rows={data.rows}
          columns={[
            { header: 'Kod', value: 'accountCode' }, { header: 'Hesab', value: 'accountName' },
            { header: 'Debet', value: 'debit' }, { header: 'Kredit', value: 'credit' },
          ]} />
      </div>
      <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Kod</TableHead><TableHead>Hesab</TableHead>
            <TableHead className="text-right">Debet</TableHead><TableHead className="text-right">Kredit</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">Hərəkət yoxdur</TableCell></TableRow>
            ) : data.rows.map((r) => (
              <TableRow key={r.accountId}>
                <TableCell className="font-mono text-xs">{r.accountCode}</TableCell>
                <TableCell>{r.accountName}</TableCell>
                <TableCell className="text-right tnum">{r.debit ? formatCurrency(r.debit) : '—'}</TableCell>
                <TableCell className="text-right tnum">{r.credit ? formatCurrency(r.credit) : '—'}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 font-bold">
              <TableCell colSpan={2}>CƏMİ</TableCell>
              <TableCell className="text-right tnum">{formatCurrency(data.totalDebit)}</TableCell>
              <TableCell className="text-right tnum">{formatCurrency(data.totalCredit)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
