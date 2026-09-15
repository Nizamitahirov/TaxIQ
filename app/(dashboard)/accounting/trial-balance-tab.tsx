'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle2, AlertTriangle, Building2 } from 'lucide-react';
import { computeTrialBalance } from '@/lib/firebase/accounting';
import { listDepartments } from '@/lib/firebase/departments';
import { Card, CardContent } from '@/components/ui/card';
import { ExportButton } from '@/components/shared/export-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils/format';
import { useTT } from '@/lib/i18n/tt';
import { cn } from '@/lib/utils/cn';

export function TrialBalanceTab({ companyId }: { companyId: string }) {
  const tt = useTT();
  const [departmentId, setDepartmentId] = useState<string>('');
  const { data, isLoading } = useQuery({ queryKey: ['trial', companyId, departmentId || 'all'], queryFn: () => computeTrialBalance(companyId, departmentId || null) });
  const { data: departments } = useQuery({ queryKey: ['departments', companyId], queryFn: () => listDepartments(companyId) });

  const filtered = !!departmentId;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!isLoading && data && (filtered ? (
            <div className="flex items-center gap-2 rounded-card border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-medium">
              <Building2 className="h-4 w-4 text-primary" /> {tt('Şöbə üzrə (qismən) — balans tələb olunmur', 'By department (partial) — balance not required')}
            </div>
          ) : (() => {
            const balanced = Math.abs(data.totalDebit - data.totalCredit) < 0.005;
            return (
              <div className={cn('flex items-center gap-2 rounded-card border px-3 py-1.5 text-sm font-medium', balanced ? 'border-success/40 bg-success/10' : 'border-danger/40 bg-danger/10')}>
                {balanced ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-danger" />}
                {balanced ? tt('Balanslaşdırılıb (Dt = Kt)', 'Balanced (Dr = Cr)') : tt('XƏBƏRDARLIQ: Dt ≠ Kt', 'WARNING: Dr ≠ Cr')}
              </div>
            );
          })())}
          {(departments ?? []).length > 0 && (
            <Select value={departmentId || 'all'} onValueChange={(v) => setDepartmentId(v === 'all' ? '' : v)}>
              <SelectTrigger className="h-9 w-56"><SelectValue placeholder={tt('Bütün şöbələr', 'All departments')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tt('Bütün şöbələr', 'All departments')}</SelectItem>
                {(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{tt(d.name.az, d.name.en)}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <ExportButton filename="yoxlama-balansi" rows={data?.rows ?? []}
          columns={[
            { header: tt('Kod', 'Code'), value: 'accountCode' }, { header: tt('Hesab', 'Account'), value: 'accountName' },
            { header: tt('Debet', 'Debit'), value: 'debit' }, { header: tt('Kredit', 'Credit'), value: 'credit' },
          ]} />
      </div>
      {isLoading || !data ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{tt('Kod', 'Code')}</TableHead><TableHead>{tt('Hesab', 'Account')}</TableHead>
              <TableHead className="text-right">{tt('Debet', 'Debit')}</TableHead><TableHead className="text-right">{tt('Kredit', 'Credit')}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.rows.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="py-8 text-center text-muted-foreground">{tt('Hərəkət yoxdur', 'No movements')}</TableCell></TableRow>
              ) : data.rows.map((r) => (
                <TableRow key={r.accountId}>
                  <TableCell className="font-mono text-xs">{r.accountCode}</TableCell>
                  <TableCell>{r.accountName}</TableCell>
                  <TableCell className="text-right tnum">{r.debit ? formatCurrency(r.debit) : '—'}</TableCell>
                  <TableCell className="text-right tnum">{r.credit ? formatCurrency(r.credit) : '—'}</TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-bold">
                <TableCell colSpan={2}>{tt('CƏMİ', 'TOTAL')}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(data.totalDebit)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(data.totalCredit)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
