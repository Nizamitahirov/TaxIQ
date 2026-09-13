'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, AlertTriangle } from 'lucide-react';
import {
  listStockBalances, listGoods, listWarehouses, postMovement, issueWithCogs, lowStockItems,
} from '@/lib/firebase/inventory';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import type { MovementType } from '@/types';

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function StockTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: balances, isLoading } = useQuery({ queryKey: ['stockBalances', companyId], queryFn: () => listStockBalances(companyId) });
  const { data: goods } = useQuery({ queryKey: ['goods', companyId], queryFn: () => listGoods(companyId) });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses', companyId], queryFn: () => listWarehouses(companyId) });

  const goodName = (id: string) => goods?.find((g) => g.id === id)?.name.az ?? id;
  const whName = (id: string) => warehouses?.find((w) => w.id === id)?.name.az ?? id;
  const low = goods && balances ? lowStockItems(goods, balances) : [];
  const totalValue = (balances ?? []).reduce((s, b) => s + (b.totalValue ?? 0), 0);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['stockBalances', companyId] });
    qc.invalidateQueries({ queryKey: ['stockMovements', companyId] });
    qc.invalidateQueries({ queryKey: ['journal', companyId] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 rounded-card border border-border bg-card px-4 py-2">
          <span className="text-sm text-muted-foreground">Ümumi anbar dəyəri:</span>
          <span className="font-bold tnum">{formatCurrency(totalValue, baseCurrency)}</span>
        </div>
        <div className="flex gap-2">
          <ExportButton filename="anbar-qaliqlari" rows={(balances ?? []).map((b) => ({ ...b, goodName: goodName(b.goodId), warehouseName: whName(b.warehouseId) }))}
            columns={[
              { header: 'Anbar', value: 'warehouseName' }, { header: 'Mal', value: 'goodName' },
              { header: 'Qalıq', value: 'quantityOnHand' }, { header: 'Orta qiymət', value: 'averageCost' }, { header: 'Dəyər', value: 'totalValue' },
            ]} />
          {canCreate && <Button size="sm" onClick={() => setOpen(true)} disabled={!goods?.length || !warehouses?.length}><Plus className="h-4 w-4" /> Əməliyyat</Button>}
        </div>
      </div>

      {low.length > 0 && (
        <Card className="rounded-card border-warning/40 bg-warning/5"><CardContent className="p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-warning-foreground"><AlertTriangle className="h-4 w-4 text-warning" /> Minimum səviyyədən aşağı: {low.length} mal</p>
          <div className="mt-2 flex flex-wrap gap-2">{low.map((x) => <Badge key={x.good.id} variant="warning">{x.good.name.az}: {formatNumber(x.onHand, 0)} / min {x.good.reorderPoint}</Badge>)}</div>
        </CardContent></Card>
      )}

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (balances ?? []).filter((b) => b.quantityOnHand !== 0).length === 0 ? (
        <EmptyState title="Anbar qalığı yoxdur" description="Mal qəbulu (əməliyyat) ilə başlayın." />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Anbar</TableHead><TableHead>Mal</TableHead><TableHead className="text-right">Qalıq</TableHead><TableHead className="text-right">Orta qiymət</TableHead><TableHead className="text-right">Dəyər</TableHead></TableRow></TableHeader>
            <TableBody>
              {(balances ?? []).filter((b) => b.quantityOnHand !== 0).map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{whName(b.warehouseId)}</TableCell>
                  <TableCell className="font-medium">{goodName(b.goodId)}</TableCell>
                  <TableCell className="text-right tnum">{formatNumber(b.quantityOnHand, 2)}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(b.averageCost, baseCurrency)}</TableCell>
                  <TableCell className="text-right tnum font-semibold">{formatCurrency(b.totalValue, baseCurrency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      {canCreate && <OperationDialog open={open} onOpenChange={setOpen} companyId={companyId} actorUid={actorUid} baseCurrency={baseCurrency}
        goods={(goods ?? []).filter((g) => g.trackInventory)} warehouses={warehouses ?? []} onSaved={invalidate} />}
    </div>
  );
}

const OPS: { value: MovementType; label: string; isIn: boolean }[] = [
  { value: 'purchase_in', label: 'Mal qəbulu (alış)', isIn: true },
  { value: 'sale_out', label: 'Satış çıxışı (COGS ilə)', isIn: false },
  { value: 'adjustment_in', label: 'Düzəliş (artım)', isIn: true },
  { value: 'adjustment_out', label: 'Düzəliş (azalma)', isIn: false },
];

function OperationDialog({ open, onOpenChange, companyId, actorUid, baseCurrency, goods, warehouses, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; baseCurrency: string;
  goods: { id: string; name: { az: string } }[]; warehouses: { id: string; name: { az: string } }[]; onSaved: () => void;
}) {
  const [op, setOp] = useState<MovementType>('purchase_in');
  const [warehouseId, setWarehouseId] = useState('');
  const [goodId, setGoodId] = useState('');
  const [qty, setQty] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const opDef = OPS.find((o) => o.value === op)!;

  async function save() {
    const g = goods.find((x) => x.id === goodId); const w = warehouses.find((x) => x.id === warehouseId);
    const q = Number(qty) || 0;
    if (!g || !w || q <= 0) { toast.error('Anbar, mal və miqdar tələb olunur'); return; }
    setSaving(true);
    try {
      const common = { companyId, warehouseId, warehouseName: w.name.az, goodId, goodName: g.name.az, movementType: op, quantity: q, movementDate: date, performedBy: actorUid, unitCost: opDef.isIn ? (Number(unitCost) || 0) : null };
      if (op === 'sale_out') await issueWithCogs({ ...common, baseCurrency });
      else await postMovement(common);
      toast.success('Hərəkət qeyd edildi', op === 'sale_out' ? 'COGS jurnal yazısı yaradıldı' : undefined);
      setGoodId(''); setQty(''); setUnitCost('');
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ehtiyat əməliyyatı</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Əməliyyat</Label>
            <Select value={op} onValueChange={(v) => setOp(v as MovementType)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{OPS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Anbar</Label>
              <Select value={warehouseId} onValueChange={setWarehouseId}><SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name.az}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Mal</Label>
              <Select value={goodId} onValueChange={setGoodId}><SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                <SelectContent>{goods.map((g) => <SelectItem key={g.id} value={g.id}>{g.name.az}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Miqdar</Label><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
            {opDef.isIn && <div className="space-y-2"><Label>Vahid qiymət</Label><Input type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} /></div>}
            <div className="space-y-2"><Label>Tarix</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Qeyd et</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
