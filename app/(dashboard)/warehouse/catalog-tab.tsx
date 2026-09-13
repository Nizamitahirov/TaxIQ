'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Package, Wrench, Warehouse as WhIcon } from 'lucide-react';
import { listGoods, createGood, listWarehouses, createWarehouse } from '@/lib/firebase/inventory';
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
import { formatCurrency } from '@/lib/utils/format';

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function CatalogTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const [goodOpen, setGoodOpen] = useState(false);
  const [whOpen, setWhOpen] = useState(false);
  const { data: goods, isLoading } = useQuery({ queryKey: ['goods', companyId], queryFn: () => listGoods(companyId) });
  const { data: warehouses } = useQuery({ queryKey: ['warehouses', companyId], queryFn: () => listWarehouses(companyId) });

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
                { header: 'SKU', value: 'sku' }, { header: 'Ad', value: (g) => g.name.az },
                { header: 'Tip', value: (g) => g.type === 'good' ? 'Mal' : 'Xidmət' }, { header: 'Vahid', value: 'baseUnit' },
                { header: 'Satış qiyməti', value: (g) => g.defaultSalePrice ?? 0 }, { header: 'ƏDV%', value: 'vatRate' },
              ]} />
            {canCreate && <Button size="sm" onClick={() => setGoodOpen(true)}><Plus className="h-4 w-4" /> Yeni</Button>}
          </div>
        </div>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (goods ?? []).length === 0 ? <EmptyState title="Mal/xidmət yoxdur" /> : (
          <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Ad</TableHead><TableHead>Tip</TableHead><TableHead>Vahid</TableHead><TableHead className="text-right">Satış qiyməti</TableHead><TableHead>ƏDV</TableHead></TableRow></TableHeader>
              <TableBody>
                {(goods ?? []).map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-mono text-sm">{g.sku}</TableCell>
                    <TableCell className="font-medium">{g.name.az}</TableCell>
                    <TableCell><Badge variant="secondary">{g.type === 'good' ? <><Package className="mr-1 inline h-3 w-3" />Mal</> : <><Wrench className="mr-1 inline h-3 w-3" />Xidmət</>}</Badge></TableCell>
                    <TableCell>{g.baseUnit}</TableCell>
                    <TableCell className="text-right tnum">{formatCurrency(g.defaultSalePrice ?? 0, baseCurrency)}</TableCell>
                    <TableCell>{g.vatRate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}
      </div>

      {canCreate && <GoodDialog open={goodOpen} onOpenChange={setGoodOpen} companyId={companyId} actorUid={actorUid} onSaved={() => qc.invalidateQueries({ queryKey: ['goods', companyId] })} />}
      {canCreate && <WarehouseDialog open={whOpen} onOpenChange={setWhOpen} companyId={companyId} onSaved={() => qc.invalidateQueries({ queryKey: ['warehouses', companyId] })} />}
    </div>
  );
}

function GoodDialog({ open, onOpenChange, companyId, actorUid, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; onSaved: () => void }) {
  const [type, setType] = useState<'good' | 'service'>('good');
  const [sku, setSku] = useState(''); const [name, setName] = useState(''); const [unit, setUnit] = useState('ədəd');
  const [salePrice, setSalePrice] = useState(''); const [purchasePrice, setPurchasePrice] = useState(''); const [vat, setVat] = useState('18');
  const [reorder, setReorder] = useState(''); const [saving, setSaving] = useState(false);

  async function save() {
    if (!sku.trim() || !name.trim()) { toast.error('SKU və ad tələb olunur'); return; }
    setSaving(true);
    try {
      await createGood({
        companyId, type, sku: sku.trim(), barcode: null, name: { az: name.trim(), en: name.trim() },
        baseUnit: unit, trackInventory: type === 'good', valuationMethodOverride: null,
        defaultPurchasePrice: purchasePrice ? Number(purchasePrice) : null, defaultSalePrice: salePrice ? Number(salePrice) : null,
        vatRate: Number(vat) || 0, reorderPoint: reorder ? Number(reorder) : null, reorderQuantity: null, isActive: true, createdBy: actorUid,
      } as Parameters<typeof createGood>[0]);
      toast.success('Əlavə edildi'); setSku(''); setName(''); setSalePrice(''); setPurchasePrice(''); setReorder('');
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Yeni mal / xidmət</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Tip</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'good' | 'service')}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="good">Mal (ehtiyat izlənir)</SelectItem><SelectItem value="service">Xidmət</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>SKU</Label><Input value={sku} onChange={(e) => setSku(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Ad</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Vahid</Label><Input value={unit} onChange={(e) => setUnit(e.target.value)} /></div>
            <div className="space-y-2"><Label>Alış qiyməti</Label><Input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} /></div>
            <div className="space-y-2"><Label>Satış qiyməti</Label><Input type="number" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>ƏDV %</Label><Input type="number" value={vat} onChange={(e) => setVat(e.target.value)} /></div>
            {type === 'good' && <div className="space-y-2"><Label>Min. səviyyə</Label><Input type="number" value={reorder} onChange={(e) => setReorder(e.target.value)} /></div>}
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Əlavə et</Button></DialogFooter>
      </DialogContent>
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
