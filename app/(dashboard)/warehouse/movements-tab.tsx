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
import { useTT } from '@/lib/i18n/tt';
import type { MovementType } from '@/types';

const LABEL: Record<MovementType, string> = {
  purchase_in: 'Alış', sale_out: 'Satış', transfer_out: 'Transfer (çıxış)', transfer_in: 'Transfer (giriş)',
  adjustment_in: 'Düzəliş +', adjustment_out: 'Düzəliş −', return_in: 'Qaytarma +', return_out: 'Qaytarma −',
};
const LABEL_EN: Record<MovementType, string> = {
  purchase_in: 'Purchase', sale_out: 'Sale', transfer_out: 'Transfer (out)', transfer_in: 'Transfer (in)',
  adjustment_in: 'Adjustment +', adjustment_out: 'Adjustment −', return_in: 'Return +', return_out: 'Return −',
};
const IN = new Set(['purchase_in', 'transfer_in', 'adjustment_in', 'return_in']);

export function MovementsTab({ companyId, baseCurrency }: { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }) {
  const tt = useTT();
  const label = (m: MovementType) => tt(LABEL[m], LABEL_EN[m]);
  const { data, isLoading } = useQuery({ queryKey: ['stockMovements', companyId], queryFn: () => listStockMovements(companyId) });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <ExportButton filename="ehtiyat-hereketleri" rows={data ?? []}
          columns={[
            { header: tt('Tarix', 'Date'), value: 'movementDate' }, { header: tt('Anbar', 'Warehouse'), value: (m) => m.warehouseName ?? '' },
            { header: tt('Mal', 'Good'), value: (m) => m.goodName ?? '' }, { header: tt('Növ', 'Type'), value: (m) => label(m.movementType) },
            { header: tt('Miqdar', 'Quantity'), value: 'quantity' }, { header: tt('Vahid qiymət', 'Unit cost'), value: (m) => m.unitCost ?? '' },
          ]} />
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Hərəkət yoxdur', 'No movements')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{tt('Tarix', 'Date')}</TableHead><TableHead>{tt('Anbar', 'Warehouse')}</TableHead><TableHead>{tt('Mal', 'Good')}</TableHead><TableHead>{tt('Növ', 'Type')}</TableHead><TableHead className="text-right">{tt('Miqdar', 'Quantity')}</TableHead><TableHead className="text-right">{tt('Vahid qiymət', 'Unit cost')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-muted-foreground">{m.movementDate}</TableCell>
                  <TableCell>{m.warehouseName}</TableCell>
                  <TableCell className="font-medium">{m.goodName}</TableCell>
                  <TableCell><Badge variant={IN.has(m.movementType) ? 'success' : 'secondary'}>{label(m.movementType)}</Badge></TableCell>
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
