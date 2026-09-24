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
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency } from '@/lib/utils/format';
import type { Good, StockBalance } from '@/types';

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function CatalogTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const tt = useTT();
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
          <h3 className="flex items-center gap-2 font-semibold"><WhIcon className="h-4 w-4 text-primary" /> {tt('Anbarlar', 'Warehouses')}</h3>
          {canCreate && <Button size="sm" variant="outline" onClick={() => setWhOpen(true)}><Plus className="h-4 w-4" /> {tt('Anbar', 'Warehouse')}</Button>}
        </div>
        <div className="flex flex-wrap gap-2">
          {(warehouses ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{tt('Anbar yoxdur', 'No warehouses')}</p> : (warehouses ?? []).map((w) => (
            <span key={w.id} className="rounded-full border border-border bg-card px-3 py-1 text-sm">{tt(w.name.az, w.name.en)} · <span className="text-muted-foreground">{w.code} · {w.type}</span></span>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{tt('Mal / Xidmət kataloqu', 'Goods / Services catalog')}</h3>
          <div className="flex gap-2">
            <ExportButton filename="mal-xidmet-kataloqu" rows={goods ?? []}
              columns={[
                { header: 'SKU', value: 'sku' }, { header: tt('Barkod', 'Barcode'), value: (g) => g.barcode ?? '' }, { header: tt('Ad', 'Name'), value: (g) => tt(g.name.az, g.name.en) },
                { header: tt('Tip', 'Type'), value: (g) => g.type === 'good' ? tt('Mal', 'Good') : tt('Xidmət', 'Service') }, { header: tt('Vahid', 'Unit'), value: 'baseUnit' },
                { header: tt('Metod', 'Method'), value: (g) => (g.valuationMethodOverride === 'fifo' ? 'FIFO' : tt('Orta çəkili', 'Weighted avg')) },
                { header: tt('Satış qiyməti', 'Sale price'), value: (g) => g.defaultSalePrice ?? 0 }, { header: 'ƏDV%', value: 'vatRate' },
              ]} />
            {canCreate && <Button size="sm" onClick={() => { setEdit(null); setGoodOpen(true); }}><Plus className="h-4 w-4" /> {tt('Yeni', 'New')}</Button>}
          </div>
        </div>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (goods ?? []).length === 0 ? <EmptyState title={tt('Mal/xidmət yoxdur', 'No goods/services')} /> : (
          <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>{tt('Ad', 'Name')}</TableHead><TableHead>{tt('Tip', 'Type')}</TableHead><TableHead>{tt('Vahid', 'Unit')}</TableHead><TableHead>{tt('Metod', 'Method')}</TableHead><TableHead className="text-right">{tt('Satış qiyməti', 'Sale price')}</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {(goods ?? []).map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-mono text-sm">{g.sku}{g.barcode && <span className="ml-1 text-xs text-muted-foreground">· {g.barcode}</span>}</TableCell>
                    <TableCell className="font-medium">{tt(g.name.az, g.name.en)}</TableCell>
                    <TableCell><Badge variant="secondary">{g.type === 'good' ? <><Package className="mr-1 inline h-3 w-3" />{tt('Mal', 'Good')}</> : <><Wrench className="mr-1 inline h-3 w-3" />{tt('Xidmət', 'Service')}</>}</Badge></TableCell>
                    <TableCell>{g.baseUnit}{(g.unitConversions ?? []).length > 0 && <span className="text-xs text-muted-foreground"> +{g.unitConversions!.length}</span>}</TableCell>
                    <TableCell>{g.trackInventory ? <Badge variant={g.valuationMethodOverride === 'fifo' ? 'default' : 'outline'}>{g.valuationMethodOverride === 'fifo' ? 'FIFO' : tt('Orta çəki', 'Weighted avg')}</Badge> : '—'}</TableCell>
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
  const tt = useTT();
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
    if (!form.sku.trim() || !form.name.trim()) { toast.error(tt('SKU və ad tələb olunur', 'SKU and name are required')); return; }
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
        toast.success(tt('Yeniləndi', 'Updated'));
      } else {
        await createGood({ companyId, ...payload, reorderQuantity: null, isActive: true, createdBy: actorUid } as Parameters<typeof createGood>[0]);
        toast.success(tt('Əlavə edildi', 'Added'));
      }
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>{edit ? tt('Mal/xidməti redaktə et', 'Edit good/service') : tt('Yeni mal / xidmət', 'New good / service')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Tip', 'Type')}</Label>
              <Select value={form.type} onValueChange={(v) => set({ type: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="good">{tt('Mal (ehtiyat izlənir)', 'Good (inventory tracked)')}</SelectItem><SelectItem value="service">{tt('Xidmət', 'Service')}</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>SKU</Label><Input value={form.sku} onChange={(e) => set({ sku: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>{tt('Ad', 'Name')}</Label><Input value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="space-y-2"><Label>{tt('Barkod', 'Barcode')}</Label>
            <div className="flex gap-2">
              <Input value={form.barcode} onChange={(e) => set({ barcode: e.target.value })} placeholder="EAN-13 / Code-128" />
              <Button type="button" variant="outline" onClick={() => setScan(true)}><ScanBarcode className="h-4 w-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>{tt('Baza vahid', 'Base unit')}</Label><Input value={form.unit} onChange={(e) => set({ unit: e.target.value })} /></div>
            <div className="space-y-2"><Label>{tt('Alış qiyməti', 'Purchase price')}</Label><Input type="number" value={form.purchasePrice} onChange={(e) => set({ purchasePrice: e.target.value })} /></div>
            <div className="space-y-2"><Label>{tt('Satış qiyməti', 'Sale price')}</Label><Input type="number" value={form.salePrice} onChange={(e) => set({ salePrice: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>ƏDV %</Label><Input type="number" value={form.vat} onChange={(e) => set({ vat: e.target.value })} /></div>
            {form.type === 'good' && <div className="space-y-2"><Label>{tt('Min. səviyyə', 'Min. level')}</Label><Input type="number" value={form.reorder} onChange={(e) => set({ reorder: e.target.value })} /></div>}
          </div>

          {form.type === 'good' && (
            <div className="space-y-2"><Label>{tt('Dəyərləndirmə metodu', 'Valuation method')}</Label>
              <Select value={form.method} onValueChange={(v) => set({ method: v })} disabled={methodLocked}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="weighted_average">{tt('Orta çəkili qiymət', 'Weighted average cost')}</SelectItem><SelectItem value="fifo">FIFO</SelectItem></SelectContent>
              </Select>
              {methodLocked && <p className="text-xs text-warning-foreground">{tt('Fəal qalığı olan malın metodu dəyişdirilə bilməz (05 §4.2).', 'The method of a good with active stock cannot be changed (05 §4.2).')}</p>}
            </div>
          )}

          {form.type === 'good' && (
            <div className="rounded-lg border border-border/60 p-3">
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-xs">{tt('Alternativ vahidlər (çevrilmə)', 'Alternative units (conversion)')}</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => set({ units: [...form.units, { code: '', factor: '' }] })}><Plus className="h-3.5 w-3.5" /></Button>
              </div>
              {form.units.length === 0 ? <p className="text-xs text-muted-foreground">{tt('Məs. «quti» = 12', 'e.g. “box” = 12')} {form.unit}</p> : form.units.map((u, i) => (
                <div key={i} className="mb-1 flex items-center gap-1">
                  <Input className="h-8 flex-1 text-sm" placeholder={tt('vahid (quti)', 'unit (box)')} value={u.code} onChange={(e) => set({ units: form.units.map((x, idx) => idx === i ? { ...x, code: e.target.value } : x) })} />
                  <span className="text-xs text-muted-foreground">=</span>
                  <Input className="h-8 w-20 text-sm" type="number" placeholder="12" value={u.factor} onChange={(e) => set({ units: form.units.map((x, idx) => idx === i ? { ...x, factor: e.target.value } : x) })} />
                  <span className="text-xs text-muted-foreground">{form.unit}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => set({ units: form.units.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yadda saxla', 'Save')}</Button></DialogFooter>
      </DialogContent>
      <BarcodeScanner open={scan} onOpenChange={setScan} onDetected={(code) => set({ barcode: code })} />
    </Dialog>
  );
}

function WarehouseDialog({ open, onOpenChange, companyId, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; companyId: string; onSaved: () => void }) {
  const tt = useTT();
  const [name, setName] = useState(''); const [code, setCode] = useState(''); const [type, setType] = useState<'main' | 'store' | 'production' | 'virtual'>('main'); const [saving, setSaving] = useState(false);
  async function save() {
    if (!name.trim()) { toast.error(tt('Ad tələb olunur', 'Name is required')); return; }
    setSaving(true);
    try {
      await createWarehouse({ companyId, name: { az: name.trim(), en: name.trim() }, code: code.trim() || name.slice(0, 3).toUpperCase(), type, address: null, linkedDepartmentId: null, isActive: true });
      toast.success(tt('Anbar əlavə edildi', 'Warehouse added')); setName(''); setCode(''); onSaved(); onOpenChange(false);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tt('Yeni anbar', 'New warehouse')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>{tt('Ad', 'Name')}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Kod', 'Code')}</Label><Input value={code} onChange={(e) => setCode(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Tip', 'Type')}</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="main">{tt('Əsas', 'Main')}</SelectItem><SelectItem value="store">{tt('Mağaza', 'Store')}</SelectItem><SelectItem value="production">{tt('İstehsalat', 'Production')}</SelectItem><SelectItem value="virtual">{tt('Virtual', 'Virtual')}</SelectItem></SelectContent></Select>
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Əlavə et', 'Add')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
