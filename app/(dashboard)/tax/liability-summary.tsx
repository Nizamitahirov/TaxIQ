'use client';

import { Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency } from '@/lib/utils/format';

export interface LiabilityRow {
  name: { az: string; en: string };
  base: number;
  rate: string;
  amount: number;
  reference: string;
  note?: { az: string; en: string };
}

/** Vergi öhdəlikləri icmalı (vahid panel) — A16 */
export function LiabilitySummary({ rows, cur, periodLabel }: { rows: LiabilityRow[]; cur: string; periodLabel: string }) {
  const tt = useTT();
  const total = rows.reduce((s, r) => s + Math.max(0, r.amount), 0);
  return (
    <Card className="rounded-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Scale className="h-4 w-4 text-primary" /> {tt('Vergi öhdəlikləri icmalı', 'Tax liabilities summary')} <Badge variant="secondary">{periodLabel}</Badge></CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tt('Vergi növü', 'Tax')}</TableHead>
              <TableHead className="text-right">{tt('Baza', 'Base')}</TableHead>
              <TableHead className="text-right">{tt('Dərəcə', 'Rate')}</TableHead>
              <TableHead className="text-right">{tt('Hesablanmış', 'Computed')}</TableHead>
              <TableHead>{tt('Maddə', 'Art.')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{tt(r.name.az, r.name.en)}{r.note && <span className="block text-xs text-muted-foreground">{tt(r.note.az, r.note.en)}</span>}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(r.base, cur)}</TableCell>
                <TableCell className="text-right tnum text-muted-foreground">{r.rate}</TableCell>
                <TableCell className={`text-right tnum font-medium ${r.amount < 0 ? 'text-success' : ''}`}>{formatCurrency(r.amount, cur)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.reference}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2">
              <TableCell className="font-semibold">{tt('Cəmi ödəniləcək', 'Total payable')}</TableCell>
              <TableCell /><TableCell />
              <TableCell className="text-right tnum font-semibold text-primary">{formatCurrency(total, cur)}</TableCell>
              <TableCell />
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
