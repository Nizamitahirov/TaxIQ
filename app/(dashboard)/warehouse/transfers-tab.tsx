'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Truck, PackageCheck } from 'lucide-react';
import {
  listTransfers, listWarehouses, listGoods, createTransfer, shipTransfer, receiveTransfer,
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
import type { StockTransfer } from '@/types';

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function TransfersTab({ companyId, canCreate, actorUid }: TabProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['transfers', companyId], queryFn: () => listTransfers(companyId) });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses', companyId], queryFn: () => listWarehouses(companyId) });
  const whName = (id: string) => warehouses?.find((w) => w.id === id)?.name.az ?? id;

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['transfers', companyId] });
    qc.invalidateQueries({ queryKey: ['stockBalances', companyId] });
    qc.invalidateQueries({ queryKey: ['stockMovements', companyId] });
  }
  async function ship(t: StockTransfer) { setBusyId(t.id); try { await shipTransfer(t, whName(t.fromWarehouseId), actorUid); toast.success('Göndərildi'); invalidate(); } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusyId(null); } }
  async function receive(t: StockTransfer) { setBusyId(t.id); try { await receiveTransfer(t, whName(t.toWarehouseId), actorUid); toast.success('Qəbul edildi'); invalidate(); } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusyId(null); } }

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        <ExportButton filename="transferler" rows={data ?? []} columns={[
          { header: 'Mənbə', value: (t) => whName(t.fromWarehouseId) }, { header: 'Təyinat', value: (t) => whName(t.toWarehouseId) },
          { header: 'Mal sayı', value: (t) => t.items.length }, { header: 'Status', value: 'status' },
        ]} />
        {canCreate && <Button size="sm" onClick={() => setOpen(true)} disabled={(warehouses?.length ?? 0) < 2}><Plus className="h-4 w-4" /> Yeni transfer</Button>}
      </div>
      {(warehouses?.length ?? 0) < 2 && <p className="mb-3 text-xs text-warning-foreground">Transfer üçün ən azı 2 anbar lazımdır.</p>}
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Transfer yoxdur" />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Mənbə</TableHead><TableHead>Təyinat</TableHead><TableHead>Mal sayı</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{whName(t.fromWarehouseId)}</TableCell>
                  <TableCell>{whName(t.toWarehouseId)}</TableCell>
                  <TableCell>{t.items.length}</TableCell>
                  <TableCell><Badge variant={t.status === 'completed' ? 'success' : t.status === 'in_transit' ? 'warning' : 'secondary'}>{t.status === 'pending' ? 'gözləyir' : t.status === 'in_transit' ? 'yolda' : t.status === 'completed' ? 'tamamlanıb' : 'ləğv'}</Badge></TableCell>
                  <TableCell className="text-right">
                    {canCreate && t.status === 'pending' && <Button variant="outline" size="sm" disabled={busyId === t.id} onClick={() => ship(t)}>{busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} Göndər</Button>}
                    {canCreate && t.status === 'in_transit' && <Button variant="outline" size="sm" disabled={busyId === t.id} onClick={() => receive(t)}>{busyId === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Qəbul et</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {canCreate && <TransferDialog open={open} onOpenChange={setOpen} companyId={companyId} actorUid={actorUid} warehouses={warehouses ?? []} onSaved={invalidate} />}
    </div>
  );
}

function TransferDialog({ open, onOpenChange, companyId, actorUid, warehouses, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; warehouses: { id: string; name: { az: string } }[]; onSaved: () => void;
}) {
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [goodId, setGoodId] = useState(''); const [qty, setQty] = useState(''); const [saving, setSaving] = useState(false);
  const { data: goods } = useQuery({ queryKey: ['goods', companyId], queryFn: () => listGoods(companyId), enabled: open });

  async function save() {
    const g = goods?.find((x) => x.id === goodId);
    if (!from || !to || from === to || !g || !(Number(qty) > 0)) { toast.error('Fərqli anbarlar, mal və miqdar tələb olunur'); return; }
    setSaving(true);
    try {
      await createTransfer({ companyId, fromWarehouseId: from, toWarehouseId: to, items: [{ goodId, goodName: g.name.az, quantity: Number(qty) }], requestedBy: actorUid });
      toast.success('Transfer yaradıldı (gözləyir)'); setGoodId(''); setQty(''); onSaved(); onOpenChange(false);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Yeni transfer</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Mənbə anbar</Label>
              <Select value={from} onValueChange={setFrom}><SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name.az}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Təyinat anbar</Label>
              <Select value={to} onValueChange={setTo}><SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                <SelectContent>{warehouses.map((w) => <SelectItem key={w.id} value={w.id}>{w.name.az}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Mal</Label>
              <Select value={goodId} onValueChange={setGoodId}><SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                <SelectContent>{(goods ?? []).filter((g) => g.trackInventory).map((g) => <SelectItem key={g.id} value={g.id}>{g.name.az}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Miqdar</Label><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Yarat</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
