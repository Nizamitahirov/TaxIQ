'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, ClipboardCheck, Check } from 'lucide-react';
import {
  listStockCounts, startStockCount, updateStockCount, finalizeStockCount,
  listGoods, listWarehouses, listStockBalances,
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
import { formatNumber } from '@/lib/utils/format';
import type { StockCount, StockCountLine } from '@/types';

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function StocktakeTab({ companyId, canCreate, actorUid }: TabProps) {
  const qc = useQueryClient();
  const [detail, setDetail] = useState<StockCount | null>(null);
  const [starting, setStarting] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['stockCounts', companyId], queryFn: () => listStockCounts(companyId) });
  const { data: goods } = useQuery({ queryKey: ['goods', companyId], queryFn: () => listGoods(companyId) });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses', companyId], queryFn: () => listWarehouses(companyId) });
  const { data: balances } = useQuery({ queryKey: ['stockBalances', companyId], queryFn: () => listStockBalances(companyId) });
  function invalidate() { qc.invalidateQueries({ queryKey: ['stockCounts', companyId] }); qc.invalidateQueries({ queryKey: ['stockBalances', companyId] }); qc.invalidateQueries({ queryKey: ['stockMovements', companyId] }); }

  const [whId, setWhId] = useState('');
  async function start() {
    const w = warehouses?.find((x) => x.id === whId);
    if (!w) { toast.error('Anbar seçin'); return; }
    setStarting(true);
    try {
      const id = await startStockCount(companyId, whId, w.name.az, goods ?? [], balances ?? [], actorUid);
      toast.success('İnventarizasiya başladıldı');
      invalidate();
      const created = await listStockCounts(companyId);
      setDetail(created.find((c) => c.id === id) ?? null);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setStarting(false); }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <p className="text-sm text-muted-foreground">Fiziki sayım → sistem qalığı ilə fərq → avtomatik düzəliş hərəkətləri (05 §6).</p>
        {canCreate && (
          <div className="flex items-end gap-2">
            <div className="space-y-1"><Label className="text-xs">Anbar</Label>
              <Select value={whId} onValueChange={setWhId}><SelectTrigger className="w-44"><SelectValue placeholder="Seç" /></SelectTrigger>
                <SelectContent>{(warehouses ?? []).map((w) => <SelectItem key={w.id} value={w.id}>{w.name.az}</SelectItem>)}</SelectContent></Select>
            </div>
            <Button size="sm" onClick={start} disabled={starting || !goods?.length}>{starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Sayım başlat</Button>
          </div>
        )}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="İnventarizasiya yoxdur" description="Anbar seçib «Sayım başlat» ilə fiziki sayıma başlayın." />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Tarix</TableHead><TableHead>Anbar</TableHead><TableHead>Mal sayı</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-muted-foreground">{c.countDate}</TableCell>
                  <TableCell className="font-medium">{c.warehouseName}</TableCell>
                  <TableCell>{c.lines.length}</TableCell>
                  <TableCell><Badge variant={c.status === 'completed' ? 'success' : c.status === 'cancelled' ? 'secondary' : 'warning'}>{c.status === 'completed' ? 'tamamlanıb' : c.status === 'cancelled' ? 'ləğv' : 'qaralama'}</Badge></TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setDetail(c)}><ClipboardCheck className="h-4 w-4" /> {c.status === 'draft' ? 'Sayımı apar' : 'Bax'}</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {detail && <CountDialog count={detail} actorUid={actorUid} onClose={() => setDetail(null)} onDone={invalidate} />}
    </div>
  );
}

function CountDialog({ count, actorUid, onClose, onDone }: { count: StockCount; actorUid: string; onClose: () => void; onDone: () => void }) {
  const [lines, setLines] = useState<StockCountLine[]>(count.lines);
  const [busy, setBusy] = useState(false);
  const editable = count.status === 'draft';
  const varianceCount = lines.filter((l) => Math.abs(l.countedQty - l.systemQty) > 0.0001).length;

  function setCounted(i: number, v: number) {
    setLines((arr) => arr.map((l, idx) => idx === i ? { ...l, countedQty: v, variance: Math.round((v - l.systemQty) * 100) / 100 } : l));
  }
  async function saveDraft() { setBusy(true); try { await updateStockCount(count.id, lines); toast.success('Yadda saxlanıldı'); onDone(); } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); } }
  async function finalize() {
    setBusy(true);
    try {
      await updateStockCount(count.id, lines);
      const { adjustments } = await finalizeStockCount({ ...count, lines }, actorUid);
      toast.success('İnventarizasiya tamamlandı', `${adjustments} düzəliş hərəkəti yaradıldı`);
      onDone(); onClose();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{count.warehouseName} — inventarizasiya ({count.countDate})</DialogTitle></DialogHeader>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{varianceCount} fərq</span>
          <ExportButton filename={`inventarizasiya-${count.countDate}`} rows={lines} columns={[
            { header: 'Mal', value: 'goodName' }, { header: 'Sistem', value: 'systemQty' }, { header: 'Sayım', value: 'countedQty' }, { header: 'Fərq', value: (l) => l.countedQty - l.systemQty },
          ]} />
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Mal</TableHead><TableHead className="text-right">Sistem</TableHead><TableHead className="text-right">Fiziki sayım</TableHead><TableHead className="text-right">Fərq</TableHead></TableRow></TableHeader>
            <TableBody>
              {lines.map((l, i) => {
                const variance = Math.round((l.countedQty - l.systemQty) * 100) / 100;
                return (
                  <TableRow key={l.goodId}>
                    <TableCell className="font-medium">{l.goodName}</TableCell>
                    <TableCell className="text-right tnum text-muted-foreground">{formatNumber(l.systemQty, 2)}</TableCell>
                    <TableCell className="text-right">{editable ? <Input type="number" defaultValue={l.countedQty} className="ml-auto w-24 text-right" onChange={(e) => setCounted(i, Number(e.target.value))} /> : <span className="tnum">{formatNumber(l.countedQty, 2)}</span>}</TableCell>
                    <TableCell className={`text-right tnum font-semibold ${variance > 0 ? 'text-success' : variance < 0 ? 'text-danger' : 'text-muted-foreground'}`}>{variance > 0 ? '+' : ''}{formatNumber(variance, 2)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {editable && (
          <DialogFooter className="flex-row justify-between">
            <Button variant="outline" onClick={saveDraft} disabled={busy}>Qaralama saxla</Button>
            <Button onClick={finalize} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Check className="h-4 w-4" />} Tamamla ({varianceCount} düzəliş)</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
