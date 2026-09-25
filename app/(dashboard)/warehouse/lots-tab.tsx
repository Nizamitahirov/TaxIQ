'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, AlertTriangle, PackageCheck } from 'lucide-react';
import { useTT } from '@/lib/i18n/tt';
import { listInventoryLots, receiveLot, deleteLot, markLotExpired, lotExpiry } from '@/lib/firebase/lots';
import { listGoods, listWarehouses } from '@/lib/firebase/inventory';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import type { InventoryLot } from '@/types';

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function LotsTab({ companyId, canCreate, actorUid }: TabProps) {
  const tt = useTT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'soon' | 'expired'>('all');

  const { data: lots, isLoading } = useQuery({ queryKey: ['inventoryLots', companyId], queryFn: () => listInventoryLots(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['inventoryLots', companyId] });

  const rows = useMemo(() => (lots ?? []).filter((l) => {
    const e = lotExpiry(l);
    if (filter === 'all') return true;
    if (filter === 'active') return l.status === 'active';
    if (filter === 'soon') return l.status === 'active' && e.state === 'soon';
    if (filter === 'expired') return l.status === 'expired' || e.state === 'expired';
    return true;
  }), [lots, filter]);

  const soonCount = useMemo(() => (lots ?? []).filter((l) => l.status === 'active' && lotExpiry(l).state === 'soon').length, [lots]);
  const expiredCount = useMemo(() => (lots ?? []).filter((l) => l.status === 'active' && lotExpiry(l).state === 'expired').length, [lots]);

  async function remove(l: InventoryLot) { if (confirm(tt('Lot silinsin?', 'Delete lot?'))) { await deleteLot(l, actorUid); refresh(); } }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {(['all', 'active', 'soon', 'expired'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-medium ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {f === 'all' ? tt('Hamısı', 'All') : f === 'active' ? tt('Aktiv', 'Active') : f === 'soon' ? tt('Tezliklə bitir', 'Expiring soon') : tt('Bitmiş', 'Expired')}
            </button>
          ))}
        </div>
        {canCreate && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Lot qəbulu', 'Receive lot')}</Button>}
      </div>

      {(soonCount > 0 || expiredCount > 0) && (
        <div className="mb-4 flex items-start gap-2 rounded-card border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>{expiredCount > 0 && <b className="text-rose-600">{tt(`${expiredCount} lot bitib. `, `${expiredCount} lot(s) expired. `)}</b>}{soonCount > 0 && tt(`${soonCount} lotun son istifadə tarixi yaxınlaşır.`, `${soonCount} lot(s) expiring soon.`)}</span>
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : rows.length === 0 ? <EmptyState title={tt('Lot yoxdur', 'No lots')} description={tt('Partiya/son istifadə tarixi ilə izlənən mallar üçün lot qəbul edin', 'Receive lots for goods tracked by batch/expiry')} action={canCreate && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Lot qəbulu', 'Receive lot')}</Button>} />
        : <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>{tt('Lot №', 'Lot №')}</TableHead><TableHead>{tt('Mal', 'Good')}</TableHead><TableHead>{tt('Anbar', 'Warehouse')}</TableHead><TableHead className="text-right">{tt('Qalıq', 'Remaining')}</TableHead><TableHead>{tt('Son istifadə', 'Expiry')}</TableHead><TableHead>{tt('Status', 'Status')}</TableHead><TableHead className="w-16" /></TableRow></TableHeader>
            <TableBody>{rows.map((l) => {
              const e = lotExpiry(l);
              return (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.lotNumber}{l.batchNumber ? <span className="ml-1 text-xs text-muted-foreground">/ {l.batchNumber}</span> : ''}</TableCell>
                  <TableCell>{l.goodName ?? '—'}</TableCell>
                  <TableCell className="text-muted-foreground">{l.warehouseName ?? '—'}</TableCell>
                  <TableCell className="text-right tnum">{l.quantityRemaining} / {l.quantityReceived}</TableCell>
                  <TableCell className="text-sm">{l.expiryDate ?? '—'}{e.daysLeft != null && e.state !== 'ok' && <span className={`ml-1 rounded px-1 text-xs ${e.state === 'expired' ? 'bg-rose-500/15 text-rose-600' : 'bg-amber-500/15 text-amber-600'}`}>{e.state === 'expired' ? tt(`${-e.daysLeft} gün keçib`, `${-e.daysLeft}d ago`) : tt(`${e.daysLeft} gün`, `${e.daysLeft}d`)}</span>}</TableCell>
                  <TableCell><Badge variant={l.status === 'active' ? (e.state === 'expired' ? 'destructive' : 'default') : l.status === 'expired' ? 'destructive' : 'secondary'}>{l.status === 'active' ? tt('Aktiv', 'Active') : l.status === 'expired' ? tt('Bitmiş', 'Expired') : tt('Tükənmiş', 'Depleted')}</Badge></TableCell>
                  <TableCell><div className="flex gap-1">
                    {canCreate && l.status === 'active' && e.state === 'expired' && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" title={tt('Bitmiş kimi işarələ', 'Mark expired')} onClick={() => markLotExpired(l, actorUid).then(refresh)}><AlertTriangle className="h-3.5 w-3.5" /></Button>}
                    {canCreate && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => remove(l)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </div></TableCell>
                </TableRow>
              );
            })}</TableBody></Table></div></CardContent></Card>}

      {open && <ReceiveDialog companyId={companyId} actorUid={actorUid} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refresh(); }} />}
    </div>
  );
}

function ReceiveDialog({ companyId, actorUid, onClose, onSaved }: { companyId: string; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const { data: goods } = useQuery({ queryKey: ['goods', companyId], queryFn: () => listGoods(companyId) });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses', companyId], queryFn: () => listWarehouses(companyId) });
  const lotGoods = useMemo(() => (goods ?? []).filter((g) => g.type === 'good' && g.trackInventory), [goods]);
  const [f, setF] = useState({ goodId: '', warehouseId: '', lotNumber: '', batchNumber: '', expiryDate: '', receivedDate: new Date().toISOString().slice(0, 10), quantity: '', unitCost: '' });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p }));

  async function save() {
    const good = lotGoods.find((g) => g.id === f.goodId);
    const wh = (warehouses ?? []).find((w) => w.id === f.warehouseId);
    if (!good || !wh || !f.lotNumber.trim() || !(Number(f.quantity) > 0)) { toast.error(tt('Mal, anbar, lot və miqdar lazımdır', 'Good, warehouse, lot and quantity required')); return; }
    setSaving(true);
    try {
      await receiveLot({
        companyId, goodId: good.id, goodName: good.name.az, warehouseId: wh.id, warehouseName: wh.name.az,
        lotNumber: f.lotNumber, batchNumber: f.batchNumber || null, expiryDate: f.expiryDate || null,
        receivedDate: f.receivedDate, quantity: Number(f.quantity), unitCost: f.unitCost ? Number(f.unitCost) : null, createdBy: actorUid,
      });
      toast.success(tt('Lot qəbul edildi', 'Lot received'));
      onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{tt('Lot qəbulu', 'Receive lot')}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1 sm:col-span-2"><Label>{tt('Mal *', 'Good *')}</Label>
          <Select value={f.goodId} onValueChange={(v) => set({ goodId: v })}><SelectTrigger><SelectValue placeholder={tt('Mal seçin', 'Select good')} /></SelectTrigger>
            <SelectContent>{lotGoods.map((g) => <SelectItem key={g.id} value={g.id}>{g.name.az} ({g.sku})</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1 sm:col-span-2"><Label>{tt('Anbar *', 'Warehouse *')}</Label>
          <Select value={f.warehouseId} onValueChange={(v) => set({ warehouseId: v })}><SelectTrigger><SelectValue placeholder={tt('Anbar seçin', 'Select warehouse')} /></SelectTrigger>
            <SelectContent>{(warehouses ?? []).map((w) => <SelectItem key={w.id} value={w.id}>{w.name.az}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>{tt('Lot nömrəsi *', 'Lot number *')}</Label><Input value={f.lotNumber} onChange={(e) => set({ lotNumber: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Partiya (batch)', 'Batch')}</Label><Input value={f.batchNumber} onChange={(e) => set({ batchNumber: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Son istifadə tarixi', 'Expiry date')}</Label><Input type="date" value={f.expiryDate} onChange={(e) => set({ expiryDate: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Qəbul tarixi', 'Received date')}</Label><Input type="date" value={f.receivedDate} onChange={(e) => set({ receivedDate: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Miqdar *', 'Quantity *')}</Label><Input type="number" value={f.quantity} onChange={(e) => set({ quantity: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Vahid dəyər', 'Unit cost')}</Label><Input type="number" value={f.unitCost} onChange={(e) => set({ unitCost: e.target.value })} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} {tt('Qəbul et', 'Receive')}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}
