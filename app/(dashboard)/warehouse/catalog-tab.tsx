'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Package, Wrench, Warehouse as WhIcon, Pencil, ScanBarcode, Trash2 } from 'lucide-react';
import { listGoods, createGood, updateGood, listWarehouses, createWarehouse, listStockBalances, goodHasStock } from '@/lib/firebase/inventory';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { BarcodeScanner } from '@/components/shared/barcode-scanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils/format';
import type { Good, StockBalance } from '@/types';

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function CatalogTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const [goodOpen, setGoodOpen] = useState(false);
  const [edit, setEdit] = useState<Good | null>(null);
  const [whOpen, setWhOpen] = useState(false);
  const { data: goods, isLoading } = useQuery({ queryKey: ['goods', companyId], queryFn: () => listGoods(companyId) });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses', companyId], queryFn: () => listWarehouses(companyId) });
  const { data: balances } = useQuery({ queryKey: ['stockBalances', companyId], queryFn: () => listStockBalances(companyId) });

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold"><WhIcon className="h-4 w-4 text-primary" /> Anbarlar</h3>
          {canCreate && <Button size="sm" variant="outline" onClick={() => setWhOpen(true)}><Plus className="h-4 w-4" /> Anbar</Button>}
        </div>
        <div className="flex flex-wrap gap-2">
          {(warehouses ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Anbar yoxdur</p> : (warehouses ?? []).map((w) => (
            <span key={w.id} className="rounded-full border border-border bg-card px-3 py-1 text-sm">{w.name.az} · <span className="text-muted-foreground">{w.code} · {w.type}</span></span>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Mal / Xidmət kataloqu</h3>
          <div className="flex gap-2">
            <ExportButton filename="mal-xidmet-kataloqu" rows={goods ?? []}
              columns={[
                { header: 'SKU', value: 'sku' }, { header: 'Barkod', value: (g) => g.barcode ?? '' }, { header: 'Ad', value: (g) => g.name.az },
                { header: 'Tip', value: (g) => g.type === 'good' ? 'Mal' : 'Xidmət' }, { header: 'Vahid', value: 'baseUnit' },
                { header: 'Metod', value: (g) => (g.valuationMethodOverride === 'fifo' ? 'FIFO' : 'Orta çəkili') },
                { header: 'Satış qiyməti', value: (g) => g.defaultSalePrice ?? 0 }, { header: 'ƏDV%', value: 'vatRate' },
              ]} />
            {canCreate && <Button size="sm" onClick={() => { setEdit(null); setGoodOpen(true); }}><Plus className="h-4 w-4" /> Yeni</Button>}
          </div>
        </div>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (goods ?? []).length === 0 ? <EmptyState title="Mal/xidmət yoxdur" /> : (
          <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Ad</TableHead><TableHead>Tip</TableHead><TableHead>Vahid</TableHead><TableHead>Metod</TableHead><TableHead className="text-right">Satış qiyməti</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {(goods ?? []).map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-mono text-sm">{g.sku}{g.barcode && <span className="ml-1 text-xs text-muted-foreground">· {g.barcode}</span>}</TableCell>
                    <TableCell className="font-medium">{g.name.az}</TableCell>
                    <TableCell><Badge variant="secondary">{g.type === 'good' ? <><Package className="mr-1 inline h-3 w-3" />Mal</> : <><Wrench className="mr-1 inline h-3 w-3" />Xidmət</>}</Badge></TableCell>
                    <TableCell>{g.baseUnit}{(g.unitConversions ?? []).length > 0 && <span className="text-xs text-muted-foreground"> +{g.unitConversions!.length}</span>}</TableCell>
                    <TableCell>{g.trackInventory ? <Badge variant={g.valuationMethodOverride === 'fifo' ? 'default' : 'outline'}>{g.valuationMethodOverride === 'fifo' ? 'FIFO' : 'Orta çəki'}</Badge> : '—'}</TableCell>
                    <TableCell className="text-right tnum">{formatCurrency(g.defaultSalePrice ?? 0, baseCurrency)}</TableCell>
                    <TableCell className="text-right">{canCreate && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEdit(g); setGoodOpen(true); }}><Pencil className="h-4 w-4" /></Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}
      </div>

      {canCreate && <GoodDialog open={goodOpen} onOpenChange={setGoodOpen} companyId={companyId} actorUid={actorUid} edit={edit} balances={balances ?? []} onSaved={() => qc.invalidateQueries({ queryKey: ['goods', companyId] })} />}
      {canCreate && <WarehouseDialog open={whOpen} onOpenChange={setWhOpen} companyId={companyId} onSaved={() => qc.invalidateQueries({ queryKey: ['warehouses', companyId] })} />}
    </div>
  );
}

function GoodDialog({ open, onOpenChange, companyId, actorUid, edit, balances, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; edit: Good | null; balances: StockBalance[]; onSaved: () => void;
}) {
  const empty = { type: 'good', sku: '', barcode: '', name: '', unit: 'ədəd', method: 'weighted_average', salePrice: '', purchasePrice: '', vat: '18', reorder: '', units: [] as { code: string; factor: string }[] };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [scan, setScan] = useState(false);
  const [key, setKey] = useState('');

  const k = (edit?.id ?? 'new') + (open ? '1' : '0');
  if (k !== key && open) {
    setKey(k);
    setForm(edit ? {
      type: edit.type, sku: edit.sku, barcode: edit.barcode ?? '', name: edit.name.az, unit: edit.baseUnit,
      method: edit.valuationMethodOverride ?? 'weighted_average', salePrice: String(edit.defaultSalePrice ?? ''),
      purchasePrice: String(edit.defaultPurchasePrice ?? ''), vat: String(edit.vatRate ?? 18), reorder: String(edit.reorderPoint ?? ''),
      units: (edit.unitConversions ?? []).map((u) => ({ code: u.code, factor: String(u.factor) })),
    } : empty);
  }
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));
  const methodLocked = !!edit && form.type === 'good' && goodHasStock(balances, edit.id);

  async function save() {
    if (!form.sku.trim() || !form.name.trim()) { toast.error('SKU və ad tələb olunur'); return; }
    setSaving(true);
    try {
      const unitConversions = form.units.filter((u) => u.code.trim() && Number(u.factor) > 0).map((u) => ({ code: u.code.trim(), factor: Number(u.factor) }));
      const payload = {
        type: form.type as 'good' | 'service', sku: form.sku.trim(), barcode: form.barcode.trim() || null,
        name: { az: form.name.trim(), en: form.name.trim() }, baseUnit: form.unit, unitConversions,
        trackInventory: form.type === 'good', valuationMethodOverride: form.type === 'good' ? (form.method as 'fifo' | 'weighted_average') : null,
        defaultPurchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null, defaultSalePrice: form.salePrice ? Number(form.salePrice) : null,
        vatRate: Number(form.vat) || 0, reorderPoint: form.reorder ? Number(form.reorder) : null,
      };
      if (edit) {
        const patch = methodLocked ? (() => { const { valuationMethodOverride, ...rest } = payload; return rest; })() : payload;
        await updateGood(edit.id, patch as Partial<Good>);
        toast.success('Yeniləndi');
      } else {
        await createGood({ companyId, ...payload, reorderQuantity: null, isActive: true, createdBy: actorUid } as Parameters<typeof createGood>[0]);
        toast.success('Əlavə edildi');
      }
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{edit ? 'Mal/xidməti redaktə et' : 'Yeni mal / xidmət'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Tip</Label>
              <Select value={form.type} onValueChange={(v) => set({ type: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="good">Mal (ehtiyat izlənir)</SelectItem><SelectItem value="service">Xidmət</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>SKU</Label><Input value={form.sku} onChange={(e) => set({ sku: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Ad</Label><Input value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Barkod</Label>
            <div className="flex gap-2">
              <Input value={form.barcode} onChange={(e) => set({ barcode: e.target.value })} placeholder="EAN-13 / Code-128" />
              <Button type="button" variant="outline" onClick={() => setScan(true)}><ScanBarcode className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Baza vahid</Label><Input value={form.unit} onChange={(e) => set({ unit: e.target.value })} /></div>
            <div className="space-y-2"><Label>Alış qiyməti</Label><Input type="number" value={form.purchasePrice} onChange={(e) => set({ purchasePrice: e.target.value })} /></div>
            <div className="space-y-2"><Label>Satış qiyməti</Label><Input type="number" value={form.salePrice} onChange={(e) => set({ salePrice: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>ƏDV %</Label><Input type="number" value={form.vat} onChange={(e) => set({ vat: e.target.value })} /></div>
            {form.type === 'good' && <div className="space-y-2"><Label>Min. səviyyə</Label><Input type="number" value={form.reorder} onChange={(e) => set({ reorder: e.target.value })} /></div>}
          </div>

          {form.type === 'good' && (
            <div className="space-y-2"><Label>Dəyərləndirmə metodu</Label>
              <Select value={form.method} onValueChange={(v) => set({ method: v })} disabled={methodLocked}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="weighted_average">Orta çəkili qiymət</SelectItem><SelectItem value="fifo">FIFO</SelectItem></SelectContent>
              </Select>
              {methodLocked && <p className="text-xs text-warning-foreground">Fəal qalığı olan malın metodu dəyişdirilə bilməz (05 §4.2).</p>}
            </div>
          )}

          {form.type === 'good' && (
            <div className="rounded-lg border border-border/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-xs">Alternativ vahidlər (çevrilmə)</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => set({ units: [...form.units, { code: '', factor: '' }] })}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              {form.units.length === 0 ? <p className="text-xs text-muted-foreground">Məs. «quti» = 12 {form.unit}</p> : form.units.map((u, i) => (
                <div key={i} className="mb-1 flex items-center gap-1">
                  <Input className="h-8 flex-1 text-sm" placeholder="vahid (quti)" value={u.code} onChange={(e) => set({ units: form.units.map((x, idx) => idx === i ? { ...x, code: e.target.value } : x) })} />
                  <span className="text-xs text-muted-foreground">=</span>
                  <Input className="h-8 w-20 text-sm" type="number" placeholder="12" value={u.factor} onChange={(e) => set({ units: form.units.map((x, idx) => idx === i ? { ...x, factor: e.target.value } : x) })} />
                  <span className="text-xs text-muted-foreground">{form.unit}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => set({ units: form.units.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Yadda saxla</Button></DialogFooter>
      </DialogContent>
      <BarcodeScanner open={scan} onOpenChange={setScan} onDetected={(code) => set({ barcode: code })} />
    </Dialog>
  );
}

function WarehouseDialog({ open, onOpenChange, companyId, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; companyId: string; onSaved: () => void }) {
  const [name, setName] = useState(''); const [code, setCode] = useState(''); const [type, setType] = useState<'main' | 'store' | 'production' | 'virtual'>('main'); const [saving, setSaving] = useState(false);
  async function save() {
    if (!name.trim()) { toast.error('Ad tələb olunur'); return; }
    setSaving(true);
    try {
      await createWarehouse({ companyId, name: { az: name.trim(), en: name.trim() }, code: code.trim() || name.slice(0, 3).toUpperCase(), type, address: null, linkedDepartmentId: null, isActive: true });
      toast.success('Anbar əlavə edildi'); setName(''); setCode(''); onSaved(); onOpenChange(false);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Yeni anbar</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Ad</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Kod</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
            <div className="space-y-2"><Label>Tip</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="main">Əsas</SelectItem><SelectItem value="store">Mağaza</SelectItem><SelectItem value="production">İstehsalat</SelectItem><SelectItem value="virtual">Virtual</SelectItem></SelectContent></Select>
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Əlavə et</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
