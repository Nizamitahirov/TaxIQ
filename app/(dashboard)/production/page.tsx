'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Pencil, Factory, CheckCircle2, Boxes } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import {
  listBoms, createBom, updateBom, deleteBom, bomComponentsCost,
  listProductionOrders, createProductionOrder, completeProductionOrder, setProductionStatus, deleteProductionOrder, scaleOrder,
} from '@/lib/firebase/production';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils/format';
import type { BillOfMaterials, BomComponent, ProductionOrder, ProductionOrderStatus } from '@/types';

const ORDER_STATUS: Record<ProductionOrderStatus, [string, string]> = {
  planned: ['Planlaşdırılıb', 'Planned'], in_progress: ['İcrada', 'In progress'], completed: ['Tamamlanıb', 'Completed'], cancelled: ['Ləğv', 'Cancelled'],
};

export default function ProductionPage() {
  const tt = useTT();
  const { active, isSuperAdmin, can } = useAuth();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('warehouse.stock.view') || can('accounting.journal.view');

  if (!companyId) return <div><PageHeader title={tt('İstehsal', 'Production')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('İstehsal', 'Production')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader title={tt('İstehsal', 'Production')} subtitle={tt('Reseptlər (BOM) və istehsal sifarişləri — maya dəyərinin kapitallaşdırılması', 'Bills of materials and production orders — cost capitalisation')} />
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders"><Factory className="mr-1.5 h-4 w-4" /> {tt('İstehsal sifarişləri', 'Production orders')}</TabsTrigger>
          <TabsTrigger value="bom"><Boxes className="mr-1.5 h-4 w-4" /> {tt('Reseptlər (BOM)', 'Bills of materials')}</TabsTrigger>
        </TabsList>
        <TabsContent value="orders"><OrdersTab companyId={companyId} cur={active!.company.baseCurrency ?? 'AZN'} /></TabsContent>
        <TabsContent value="bom"><BomTab companyId={companyId} cur={active!.company.baseCurrency ?? 'AZN'} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ─────────── Orders ─────────── */
function OrdersTab({ companyId, cur }: { companyId: string; cur: string }) {
  const tt = useTT();
  const qc = useQueryClient();
  const { profile, isSuperAdmin, can } = useAuth();
  const canEdit = isSuperAdmin || can('warehouse.stock.view') || can('accounting.journal.create');
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['productionOrders', companyId], queryFn: () => listProductionOrders(companyId) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['productionOrders', companyId] }); };

  async function complete(o: ProductionOrder) {
    try { const jid = await completeProductionOrder(o, profile?.uid ?? ''); refresh(); toast.success(tt('Tamamlandı', 'Completed'), jid ? tt('Maya dəyəri kapitallaşdırıldı', 'Cost capitalised') : tt('Jurnal yazısı üçün hesablar tapılmadı', 'Accounts for journal not found')); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
  }

  return (
    <div className="mt-4">
      {canEdit && <div className="mb-3 flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni sifariş', 'New order')}</Button></div>}
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : !data || data.length === 0 ? <EmptyState title={tt('İstehsal sifarişi yoxdur', 'No production orders')} />
        : <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>№</TableHead><TableHead>{tt('Məhsul', 'Product')}</TableHead><TableHead className="text-right">{tt('Say', 'Qty')}</TableHead><TableHead className="text-right">{tt('Material', 'Material')}</TableHead><TableHead className="text-right">{tt('Maya', 'Cost')}</TableHead><TableHead className="text-right">{tt('Vahid maya', 'Unit cost')}</TableHead><TableHead>{tt('Status', 'Status')}</TableHead><TableHead className="w-24" /></TableRow></TableHeader>
            <TableBody>{data.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.orderNumber}</TableCell>
                <TableCell>{o.productName}</TableCell>
                <TableCell className="text-right tnum">{o.quantity}</TableCell>
                <TableCell className="text-right tnum text-muted-foreground">{formatCurrency(o.materialCost, cur)}</TableCell>
                <TableCell className="text-right tnum font-semibold">{formatCurrency(o.totalCost, cur)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(o.unitCost, cur)}</TableCell>
                <TableCell><Badge variant={o.status === 'completed' ? 'default' : o.status === 'cancelled' ? 'destructive' : 'secondary'}>{tt(ORDER_STATUS[o.status][0], ORDER_STATUS[o.status][1])}</Badge></TableCell>
                <TableCell><div className="flex gap-1">
                  {canEdit && o.status !== 'completed' && o.status !== 'cancelled' && <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" title={tt('Tamamla', 'Complete')} onClick={() => complete(o)}><CheckCircle2 className="h-4 w-4" /></Button>}
                  {canEdit && o.status === 'planned' && <Button variant="ghost" size="icon" className="h-7 w-7" title={tt('İcraya keçir', 'Start')} onClick={() => setProductionStatus(o, 'in_progress', profile?.uid ?? '').then(refresh)}><Factory className="h-3.5 w-3.5" /></Button>}
                  {canEdit && o.status !== 'completed' && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => { if (confirm(tt('Silinsin?', 'Delete?'))) deleteProductionOrder(o, profile?.uid ?? '').then(refresh); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div></TableCell>
              </TableRow>))}</TableBody></Table></div></CardContent></Card>}
      {open && <OrderDialog companyId={companyId} cur={cur} actorUid={profile?.uid ?? ''} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refresh(); }} />}
    </div>
  );
}

function OrderDialog({ companyId, cur, actorUid, onClose, onSaved }: { companyId: string; cur: string; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const { data: boms } = useQuery({ queryKey: ['boms', companyId], queryFn: () => listBoms(companyId) });
  const [bomId, setBomId] = useState('');
  const [productName, setProductName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [comps, setComps] = useState<BomComponent[]>([{ description: '', quantity: 1, unit: '', unitCost: 0 }]);
  const [labor, setLabor] = useState('0'); const [overhead, setOverhead] = useState('0');
  const [saving, setSaving] = useState(false);

  function applyBom(id: string) {
    setBomId(id);
    const bom = (boms ?? []).find((b) => b.id === id);
    if (!bom) return;
    const qty = Number(quantity) || bom.outputQuantity || 1;
    const s = scaleOrder(bom, qty);
    setProductName(bom.productName);
    setComps(s.components.length ? s.components : [{ description: '', quantity: 1, unit: '', unitCost: 0 }]);
    setLabor(String(s.laborCost)); setOverhead(String(s.overheadCost));
  }

  const materialCost = bomComponentsCost(comps);
  const totalCost = materialCost + (Number(labor) || 0) + (Number(overhead) || 0);
  const setComp = (i: number, p: Partial<BomComponent>) => setComps((cs) => cs.map((c, j) => j === i ? { ...c, ...p } : c));

  async function save() {
    if (!productName.trim()) { toast.error(tt('Məhsul adı lazımdır', 'Product name required')); return; }
    const qty = Number(quantity) || 0;
    if (qty <= 0) { toast.error(tt('Say düzgün deyil', 'Invalid quantity')); return; }
    setSaving(true);
    try {
      await createProductionOrder({
        companyId, bomId: bomId || null, productName: productName.trim(), quantity: qty, startDate,
        components: comps.filter((c) => c.description.trim()),
        materialCost, laborCost: Number(labor) || 0, overheadCost: Number(overhead) || 0, createdBy: actorUid,
      });
      toast.success(tt('Sifariş yaradıldı', 'Order created'));
      onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>{tt('Yeni istehsal sifarişi', 'New production order')}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>{tt('Resept (BOM)', 'Bill of materials')}</Label>
            <Select value={bomId} onValueChange={applyBom}><SelectTrigger><SelectValue placeholder={tt('Seçin (opsional)', 'Select (optional)')} /></SelectTrigger>
              <SelectContent>{(boms ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.productName}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>{tt('Məhsul *', 'Product *')}</Label><Input value={productName} onChange={(e) => setProductName(e.target.value)} /></div>
          <div className="space-y-1"><Label>{tt('Say', 'Quantity')}</Label><Input type="number" value={quantity} onChange={(e) => { setQuantity(e.target.value); if (bomId) applyBom(bomId); }} /></div>
          <div className="space-y-1"><Label>{tt('Başlama tarixi', 'Start date')}</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        </div>
        <div>
          <Label>{tt('Materiallar', 'Materials')}</Label>
          <div className="mt-1 space-y-2">
            {comps.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_70px_100px_auto] gap-2">
                <Input placeholder={tt('Material', 'Material')} value={c.description} onChange={(e) => setComp(i, { description: e.target.value })} />
                <Input type="number" placeholder={tt('Say', 'Qty')} value={c.quantity} onChange={(e) => setComp(i, { quantity: Number(e.target.value) })} />
                <Input placeholder={tt('Vahid', 'Unit')} value={c.unit ?? ''} onChange={(e) => setComp(i, { unit: e.target.value })} />
                <Input type="number" placeholder={tt('Qiymət', 'Cost')} value={c.unitCost ?? 0} onChange={(e) => setComp(i, { unitCost: Number(e.target.value) })} />
                <Button variant="ghost" size="icon" className="h-9 w-9 text-rose-600" onClick={() => setComps((cs) => cs.length > 1 ? cs.filter((_, j) => j !== i) : cs)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setComps((cs) => [...cs, { description: '', quantity: 1, unit: '', unitCost: 0 }])}><Plus className="h-3.5 w-3.5" /> {tt('Material', 'Material')}</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>{tt('Əmək haqqı', 'Labor cost')}</Label><Input type="number" value={labor} onChange={(e) => setLabor(e.target.value)} /></div>
          <div className="space-y-1"><Label>{tt('Üstəlik xərclər', 'Overhead')}</Label><Input type="number" value={overhead} onChange={(e) => setOverhead(e.target.value)} /></div>
        </div>
        <div className="rounded-lg bg-secondary/40 p-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">{tt('Material', 'Material')}</span><span className="tnum">{formatCurrency(materialCost, cur)}</span></div>
          <div className="mt-1 flex justify-between font-semibold"><span>{tt('Ümumi maya', 'Total cost')}</span><span className="tnum text-primary">{formatCurrency(totalCost, cur)}</span></div>
        </div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Factory className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}

/* ─────────── BOM ─────────── */
function BomTab({ companyId, cur }: { companyId: string; cur: string }) {
  const tt = useTT();
  const qc = useQueryClient();
  const { profile, isSuperAdmin, can } = useAuth();
  const canEdit = isSuperAdmin || can('warehouse.stock.view');
  const [editing, setEditing] = useState<BillOfMaterials | 'new' | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['boms', companyId], queryFn: () => listBoms(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['boms', companyId] });

  return (
    <div className="mt-4">
      {canEdit && <div className="mb-3 flex justify-end"><Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> {tt('Yeni resept', 'New BOM')}</Button></div>}
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : !data || data.length === 0 ? <EmptyState title={tt('Resept yoxdur', 'No bills of materials')} />
        : <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>{tt('Məhsul', 'Product')}</TableHead><TableHead className="text-right">{tt('Çıxış', 'Output')}</TableHead><TableHead className="text-right">{tt('Komponent', 'Components')}</TableHead><TableHead className="text-right">{tt('Material maya', 'Material cost')}</TableHead><TableHead>{tt('Status', 'Status')}</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
            <TableBody>{data.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.productName}</TableCell>
                <TableCell className="text-right tnum">{b.outputQuantity} {b.unit ?? ''}</TableCell>
                <TableCell className="text-right tnum">{b.components.length}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(bomComponentsCost(b.components), cur)}</TableCell>
                <TableCell><Badge variant={b.isActive ? 'default' : 'secondary'}>{b.isActive ? tt('Aktiv', 'Active') : tt('Passiv', 'Inactive')}</Badge></TableCell>
                <TableCell>{canEdit && <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(b)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => { if (confirm(tt('Silinsin?', 'Delete?'))) deleteBom(b, profile?.uid ?? '').then(refresh); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>}</TableCell>
              </TableRow>))}</TableBody></Table></div></CardContent></Card>}
      {editing && <BomDialog companyId={companyId} cur={cur} actorUid={profile?.uid ?? ''} bom={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />}
    </div>
  );
}

function BomDialog({ companyId, cur, actorUid, bom, onClose, onSaved }: { companyId: string; cur: string; actorUid: string; bom: BillOfMaterials | null; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [productName, setProductName] = useState(bom?.productName ?? '');
  const [outputQuantity, setOutputQuantity] = useState(String(bom?.outputQuantity ?? 1));
  const [unit, setUnit] = useState(bom?.unit ?? '');
  const [comps, setComps] = useState<BomComponent[]>(bom?.components?.length ? bom.components : [{ description: '', quantity: 1, unit: '', unitCost: 0 }]);
  const [labor, setLabor] = useState(String(bom?.laborCost ?? 0)); const [overhead, setOverhead] = useState(String(bom?.overheadCost ?? 0));
  const [isActive, setIsActive] = useState(bom?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const materialCost = useMemo(() => bomComponentsCost(comps), [comps]);
  const setComp = (i: number, p: Partial<BomComponent>) => setComps((cs) => cs.map((c, j) => j === i ? { ...c, ...p } : c));

  async function save() {
    if (!productName.trim()) { toast.error(tt('Məhsul adı lazımdır', 'Product name required')); return; }
    setSaving(true);
    try {
      const payload = {
        companyId, productGoodId: bom?.productGoodId ?? null, productName: productName.trim(),
        outputQuantity: Number(outputQuantity) || 1, unit: unit || null,
        components: comps.filter((c) => c.description.trim()), laborCost: Number(labor) || 0, overheadCost: Number(overhead) || 0,
        notes: bom?.notes ?? null, isActive,
      };
      if (bom) await updateBom(bom.id, payload);
      else await createBom({ ...payload, createdBy: actorUid });
      toast.success(tt('Yadda saxlanıldı', 'Saved'));
      onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>{bom ? tt('Resepti redaktə et', 'Edit BOM') : tt('Yeni resept', 'New BOM')}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2"><Label>{tt('Məhsul *', 'Product *')}</Label><Input value={productName} onChange={(e) => setProductName(e.target.value)} /></div>
          <div className="space-y-1"><Label>{tt('Çıxış miqdarı', 'Output qty')}</Label><Input type="number" value={outputQuantity} onChange={(e) => setOutputQuantity(e.target.value)} /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1"><Label>{tt('Vahid', 'Unit')}</Label><Input value={unit ?? ''} onChange={(e) => setUnit(e.target.value)} placeholder={tt('ədəd, kq…', 'pcs, kg…')} /></div>
          <div className="space-y-1"><Label>{tt('Əmək haqqı', 'Labor cost')}</Label><Input type="number" value={labor} onChange={(e) => setLabor(e.target.value)} /></div>
          <div className="space-y-1"><Label>{tt('Üstəlik', 'Overhead')}</Label><Input type="number" value={overhead} onChange={(e) => setOverhead(e.target.value)} /></div>
        </div>
        <div>
          <Label>{tt('Komponentlər', 'Components')}</Label>
          <div className="mt-1 space-y-2">
            {comps.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_80px_70px_100px_auto] gap-2">
                <Input placeholder={tt('Material', 'Material')} value={c.description} onChange={(e) => setComp(i, { description: e.target.value })} />
                <Input type="number" placeholder={tt('Say', 'Qty')} value={c.quantity} onChange={(e) => setComp(i, { quantity: Number(e.target.value) })} />
                <Input placeholder={tt('Vahid', 'Unit')} value={c.unit ?? ''} onChange={(e) => setComp(i, { unit: e.target.value })} />
                <Input type="number" placeholder={tt('Qiymət', 'Cost')} value={c.unitCost ?? 0} onChange={(e) => setComp(i, { unitCost: Number(e.target.value) })} />
                <Button variant="ghost" size="icon" className="h-9 w-9 text-rose-600" onClick={() => setComps((cs) => cs.length > 1 ? cs.filter((_, j) => j !== i) : cs)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setComps((cs) => [...cs, { description: '', quantity: 1, unit: '', unitCost: 0 }])}><Plus className="h-3.5 w-3.5" /> {tt('Komponent', 'Component')}</Button>
            <span className="text-sm font-semibold">{tt('Material maya', 'Material cost')}: {formatCurrency(materialCost, cur)}</span>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> {tt('Aktiv', 'Active')}</label>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />} {tt('Yadda saxla', 'Save')}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}
