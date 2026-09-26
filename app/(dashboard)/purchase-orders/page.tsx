'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Check, PackageCheck, FileText, X } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listPurchaseOrders, createPurchaseOrder, setPOStatus, convertPOToBill, poTotals, receivePOLines, threeWayMatch } from '@/lib/firebase/purchasing';
import { listVendors } from '@/lib/firebase/treasury';
import { PageHeader } from '@/components/shared/page-header';
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
import { formatCurrency } from '@/lib/utils/format';
import type { PurchaseOrder, DocLineItem } from '@/types';

type Line = Pick<DocLineItem, 'description' | 'quantity' | 'unitPrice' | 'vatRate'>;
const emptyLine = (): Line => ({ description: '', quantity: 1, unitPrice: 0, vatRate: 18 });

const STATUS_TINT: Record<string, 'secondary' | 'default' | 'success' | 'destructive'> = {
  draft: 'secondary', confirmed: 'default', partially_received: 'default', received: 'default', billed: 'success', cancelled: 'destructive',
};

export default function PurchaseOrdersPage() {
  const tt = useTT();
  const qc = useQueryClient();
  const { active, isSuperAdmin, can, profile } = useAuth();
  const companyId = active?.companyId;
  const cur = active?.company.baseCurrency ?? 'AZN';
  const canView = isSuperAdmin || can('cashbank.transaction.view') || can('accounting.coa.view');
  const canEdit = isSuperAdmin || can('cashbank.transaction.create');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['purchaseOrders', companyId], queryFn: () => listPurchaseOrders(companyId!), enabled: canView && !!companyId });
  const refresh = () => qc.invalidateQueries({ queryKey: ['purchaseOrders', companyId] });

  const statusLabel = (s: string) => ({
    draft: tt('Layihə', 'Draft'), confirmed: tt('Təsdiqlənib', 'Confirmed'), partially_received: tt('Qismən qəbul', 'Partially received'),
    received: tt('Qəbul edilib', 'Received'), billed: tt('Fakturalanıb', 'Billed'), cancelled: tt('Ləğv', 'Cancelled'),
  }[s] ?? s);
  const [receivePo, setReceivePo] = useState<PurchaseOrder | null>(null);

  async function act(po: PurchaseOrder, fn: () => Promise<unknown>, okAz: string, okEn: string) {
    setBusy(po.id);
    try { await fn(); toast.success(tt(okAz, okEn)); refresh(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusy(null); }
  }

  if (!companyId) return <div><PageHeader title={tt('Satınalma sifarişləri', 'Purchase orders')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('Satınalma sifarişləri', 'Purchase orders')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader
        title={tt('Satınalma sifarişləri', 'Purchase orders')}
        subtitle={tt('PO → mal qəbulu → fakturaya çevirmə (üçtərəfli uzlaşma)', 'PO → goods receipt → convert to bill (3-way match)')}
        action={canEdit && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni sifariş', 'New order')}</Button>}
      />

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : !data || data.length === 0 ? <EmptyState title={tt('Sifariş yoxdur', 'No orders')} description={tt('İlk satınalma sifarişini yaradın', 'Create your first purchase order')} action={canEdit && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni sifariş', 'New order')}</Button>} />
        : (
          <Card className="rounded-card"><CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>№</TableHead><TableHead>{tt('Təchizatçı', 'Vendor')}</TableHead><TableHead>{tt('Tarix', 'Date')}</TableHead>
                  <TableHead className="text-right">{tt('Məbləğ', 'Amount')}</TableHead><TableHead>Status</TableHead><TableHead className="text-right">{tt('Əməliyyat', 'Actions')}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {data.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">{po.poNumber}</TableCell>
                      <TableCell>{po.vendorName ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{po.orderDate}</TableCell>
                      <TableCell className="text-right tnum font-semibold">{formatCurrency(po.grandTotal, po.currency || cur)}</TableCell>
                      <TableCell>
                        <Badge variant={STATUS_TINT[po.status] ?? 'secondary'}>{statusLabel(po.status)}</Badge>
                        {(po.status === 'partially_received' || po.status === 'received') && po.receivedQty && (() => {
                          const ord = po.lineItems.reduce((s, l) => s + l.quantity, 0);
                          const rec = po.receivedQty.reduce((s, q) => s + (q || 0), 0);
                          return <span className="mt-1 block text-[11px] text-muted-foreground">{tt('Qəbul', 'Received')}: {Math.round(rec * 100) / 100}/{Math.round(ord * 100) / 100}</span>;
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canEdit && po.status === 'draft' && <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" title={tt('Təsdiqlə', 'Confirm')} disabled={busy === po.id} onClick={() => act(po, () => setPOStatus(po, 'confirmed', profile?.uid ?? ''), 'Təsdiqləndi', 'Confirmed')}><Check className="h-4 w-4" /></Button>}
                          {canEdit && (po.status === 'confirmed' || po.status === 'partially_received') && <Button size="icon" variant="ghost" className="h-8 w-8 text-sky-600" title={tt('Mal qəbulu', 'Receive goods')} disabled={busy === po.id} onClick={() => setReceivePo(po)}><PackageCheck className="h-4 w-4" /></Button>}
                          {canEdit && po.status === 'received' && <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600" title={tt('Fakturaya çevir', 'Convert to bill')} disabled={busy === po.id} onClick={() => act(po, () => convertPOToBill(po, 30, profile?.uid ?? ''), 'Faktura yaradıldı', 'Bill created')}><FileText className="h-4 w-4" /></Button>}
                          {po.status === 'billed' && <span className="text-xs text-emerald-600">✓ {tt('uzlaşdırıldı', 'matched')}</span>}
                          {canEdit && (po.status === 'draft' || po.status === 'confirmed') && <Button size="icon" variant="ghost" className="h-8 w-8 text-danger" title={tt('Ləğv et', 'Cancel')} disabled={busy === po.id} onClick={() => act(po, () => setPOStatus(po, 'cancelled', profile?.uid ?? ''), 'Ləğv edildi', 'Cancelled')}><X className="h-4 w-4" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent></Card>
        )}

      {open && <CreateDialog companyId={companyId} cur={cur} actorUid={profile?.uid ?? ''} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refresh(); }} />}
      {receivePo && <ReceiveDialog po={receivePo} actorUid={profile?.uid ?? ''} onClose={() => setReceivePo(null)} onSaved={() => { setReceivePo(null); refresh(); }} />}
    </div>
  );
}

function ReceiveDialog({ po, actorUid, onClose, onSaved }: { po: PurchaseOrder; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const match = threeWayMatch(po);
  const [add, setAdd] = useState<string[]>(po.lineItems.map((l, i) => String(Math.max(0, l.quantity - (match[i]?.received ?? 0)))));
  const [saving, setSaving] = useState(false);
  const setQ = (i: number, v: string) => setAdd((a) => a.map((x, j) => (j === i ? v : x)));

  async function save() {
    const nums = add.map((x) => Number(x) || 0);
    if (nums.every((n) => n <= 0)) { toast.error(tt('Qəbul miqdarı daxil edin', 'Enter received quantity')); return; }
    setSaving(true);
    try {
      await receivePOLines(po, nums, actorUid);
      toast.success(tt('Mal qəbulu qeydə alındı', 'Goods receipt recorded'));
      onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{tt('Mal qəbulu', 'Goods receipt')} — {po.poNumber}</DialogTitle></DialogHeader>
        <div className="rounded-lg border border-border">
          <div className="grid grid-cols-[1fr_70px_80px_80px] gap-2 border-b border-border bg-secondary/40 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
            <span>{tt('Təsvir', 'Description')}</span><span className="text-right">{tt('Sifariş', 'Ordered')}</span><span className="text-right">{tt('Öncə', 'Prev.')}</span><span className="text-right">{tt('İndi qəbul', 'Receive now')}</span>
          </div>
          {po.lineItems.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_80px_80px] items-center gap-2 border-b border-border/50 px-3 py-1.5 last:border-0">
              <span className="truncate text-sm">{l.description}</span>
              <span className="text-right tnum text-sm">{l.quantity}</span>
              <span className="text-right tnum text-sm text-muted-foreground">{match[i]?.received ?? 0}</span>
              <Input className="h-8 text-right" type="number" value={add[i]} onChange={(e) => setQ(i, e.target.value)} />
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{tt('Sifarişdən çox qəbul edilə bilməz. Bütün sətirlər tam qəbul olunduqda sifariş «Qəbul edilib» statusuna keçir və fakturaya çevrilə bilər.', 'Cannot receive more than ordered. When every line is fully received the order becomes “Received” and can be converted to a bill.')}</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} {tt('Qəbul et', 'Receive')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateDialog({ companyId, cur, actorUid, onClose, onSaved }: { companyId: string; cur: string; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const { data: vendors } = useQuery({ queryKey: ['vendors', companyId], queryFn: () => listVendors(companyId) });
  const [vendorId, setVendorId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState('');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => poTotals(lines.map((l) => ({ ...l, discountPercent: 0, goodId: null, unit: '' }))), [lines]);
  const setLine = (i: number, p: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));

  async function save() {
    const vendor = vendors?.find((v) => v.id === vendorId);
    if (!vendor) { toast.error(tt('Təchizatçı seçin', 'Select a vendor')); return; }
    const valid = lines.filter((l) => l.description.trim() && l.quantity > 0);
    if (!valid.length) { toast.error(tt('Ən azı bir sətir daxil edin', 'Add at least one line')); return; }
    setSaving(true);
    try {
      await createPurchaseOrder({
        companyId, vendorId, vendorName: vendor.name, orderDate, expectedDate: expectedDate || null, currency: cur,
        lineItems: valid.map((l) => ({ goodId: null, description: l.description.trim(), quantity: Number(l.quantity) || 0, unit: '', unitPrice: Number(l.unitPrice) || 0, discountPercent: 0, vatRate: Number(l.vatRate) || 0 })),
        createdBy: actorUid,
      });
      toast.success(tt('Sifariş yaradıldı', 'Order created'));
      onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{tt('Yeni satınalma sifarişi', 'New purchase order')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-1"><Label>{tt('Təchizatçı', 'Vendor')}</Label>
              <Select value={vendorId} onValueChange={setVendorId}><SelectTrigger><SelectValue placeholder={tt('Seçin', 'Select')} /></SelectTrigger>
                <SelectContent>{(vendors ?? []).map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1"><Label>{tt('Sifariş tarixi', 'Order date')}</Label><Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></div>
            <div className="space-y-1"><Label>{tt('Gözlənilən', 'Expected')}</Label><Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} /></div>
          </div>

          <div className="rounded-lg border border-border">
            <div className="grid grid-cols-[1fr_70px_90px_60px_32px] gap-2 border-b border-border bg-secondary/40 px-3 py-2 text-[11px] font-semibold text-muted-foreground">
              <span>{tt('Təsvir', 'Description')}</span><span className="text-right">{tt('Say', 'Qty')}</span><span className="text-right">{tt('Qiymət', 'Price')}</span><span className="text-right">ƏDV%</span><span />
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_90px_60px_32px] items-center gap-2 border-b border-border/50 px-3 py-1.5 last:border-0">
                <Input className="h-8" value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder={tt('Mal/xidmət', 'Item/service')} />
                <Input className="h-8 text-right" type="number" value={l.quantity} onChange={(e) => setLine(i, { quantity: Number(e.target.value) })} />
                <Input className="h-8 text-right" type="number" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) })} />
                <Input className="h-8 text-right" type="number" value={l.vatRate} onChange={(e) => setLine(i, { vatRate: Number(e.target.value) })} />
                <Button size="icon" variant="ghost" className="h-8 w-8 text-danger" onClick={() => setLines((ls) => ls.length > 1 ? ls.filter((_, j) => j !== i) : ls)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
            <div className="px-3 py-2"><Button size="sm" variant="outline" onClick={() => setLines((ls) => [...ls, emptyLine()])}><Plus className="h-3.5 w-3.5" /> {tt('Sətir', 'Row')}</Button></div>
          </div>

          <div className="flex justify-end gap-6 text-sm">
            <span className="text-muted-foreground">{tt('Ara cəmi', 'Subtotal')}: <b className="text-foreground">{formatCurrency(totals.subtotal, cur)}</b></span>
            <span className="text-muted-foreground">ƏDV: <b className="text-foreground">{formatCurrency(totals.vatTotal, cur)}</b></span>
            <span className="font-semibold">{tt('Yekun', 'Total')}: <b className="text-primary">{formatCurrency(totals.grandTotal, cur)}</b></span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
