'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { listStockMovements } from '@/lib/firebase/inventory';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatNumber, formatCurrency } from '@/lib/utils/format';
import type { MovementType } from '@/types';

const LABEL: Record<MovementType, string> = {
  purchase_in: 'Alış', sale_out: 'Satış', transfer_out: 'Transfer (çıxış)', transfer_in: 'Transfer (giriş)',
  adjustment_in: 'Düzəliş +', adjustment_out: 'Düzəliş −', return_in: 'Qaytarma +', return_out: 'Qaytarma −',
};
const IN = new Set(['purchase_in', 'transfer_in', 'adjustment_in', 'return_in']);

export function MovementsTab({ companyId, baseCurrency }: { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }) {
  const { data, isLoading } = useQuery({ queryKey: ['stockMovements', companyId], queryFn: () => listStockMovements(companyId) });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <ExportButton filename="ehtiyat-hereketleri" rows={data ?? []}
          columns={[
            { header: 'Tarix', value: 'movementDate' }, { header: 'Anbar', value: (m) => m.warehouseName ?? '' },
            { header: 'Mal', value: (m) => m.goodName ?? '' }, { header: 'Növ', value: (m) => LABEL[m.movementType] },
            { header: 'Miqdar', value: 'quantity' }, { header: 'Vahid qiymət', value: (m) => m.unitCost ?? '' },
          ]} />
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Hərəkət yoxdur" />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Tarix</TableHead><TableHead>Anbar</TableHead><TableHead>Mal</TableHead><TableHead>Növ</TableHead><TableHead className="text-right">Miqdar</TableHead><TableHead className="text-right">Vahid qiymət</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-muted-foreground">{m.movementDate}</TableCell>
                  <TableCell>{m.warehouseName}</TableCell>
                  <TableCell className="font-medium">{m.goodName}</TableCell>
                  <TableCell><Badge variant={IN.has(m.movementType) ? 'success' : 'secondary'}>{LABEL[m.movementType]}</Badge></TableCell>
                  <TableCell className={`text-right tnum ${IN.has(m.movementType) ? 'text-success' : 'text-danger'}`}>{IN.has(m.movementType) ? '+' : '−'}{formatNumber(m.quantity, 2)}</TableCell>
                  <TableCell className="text-right tnum">{m.unitCost != null ? formatCurrency(m.unitCost, baseCurrency) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
