'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Printer, Trash2, Truck, FileText, Send } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import {
  listDeliveryNotes, deliveryNoteFromInvoice, setDeliveryNoteStatus, deleteDeliveryNote,
  listCmrConsignments, createCmr, deleteCmr,
  listRemittanceAdvices, createRemittanceAdvice, deleteRemittanceAdvice,
} from '@/lib/firebase/trade-documents';
import { listInvoices } from '@/lib/firebase/sales';
import { printDeliveryNote, printCmr, printRemittance } from './print-docs';
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
import type { Company, CmrKind } from '@/types';

export default function DocumentsPage() {
  const tt = useTT();
  const { active, isSuperAdmin, can } = useAuth();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('sales.invoice.view') || can('cashbank.transaction.view');

  if (!companyId) return <div><PageHeader title={tt('Sənədlər', 'Documents')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('Sənədlər', 'Documents')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader title={tt('Sənədlər', 'Documents')} subtitle={tt('Təhvil qaimələri, CMR və ödəniş məktubları', 'Delivery notes, CMR and remittance advices')} />
      <Tabs defaultValue="delivery">
        <TabsList>
          <TabsTrigger value="delivery"><Truck className="mr-1.5 h-4 w-4" /> {tt('Təhvil qaiməsi', 'Delivery notes')}</TabsTrigger>
          <TabsTrigger value="cmr"><FileText className="mr-1.5 h-4 w-4" /> CMR</TabsTrigger>
          <TabsTrigger value="remittance"><Send className="mr-1.5 h-4 w-4" /> {tt('Ödəniş məktubu', 'Remittance')}</TabsTrigger>
        </TabsList>
        <TabsContent value="delivery"><DeliveryTab company={active!.company} /></TabsContent>
        <TabsContent value="cmr"><CmrTab company={active!.company} /></TabsContent>
        <TabsContent value="remittance"><RemittanceTab company={active!.company} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ─────────── Delivery notes ─────────── */
function DeliveryTab({ company }: { company: Company }) {
  const tt = useTT();
  const qc = useQueryClient();
  const { profile, isSuperAdmin, can } = useAuth();
  const companyId = company.id;
  const cur = company.baseCurrency ?? 'AZN';
  const canEdit = isSuperAdmin || can('sales.invoice.create');
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['deliveryNotes', companyId], queryFn: () => listDeliveryNotes(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['deliveryNotes', companyId] });

  const STATUS: Record<string, [string, string]> = { draft: ['Layihə', 'Draft'], despatched: ['Göndərilib', 'Despatched'], delivered: ['Çatdırılıb', 'Delivered'], cancelled: ['Ləğv', 'Cancelled'] };

  return (
    <div className="mt-4">
      {canEdit && <div className="mb-3 flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Fakturadan yarat', 'Create from invoice')}</Button></div>}
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : !data || data.length === 0 ? <EmptyState title={tt('Təhvil qaiməsi yoxdur', 'No delivery notes')} />
        : <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>№</TableHead><TableHead>{tt('Müştəri', 'Customer')}</TableHead><TableHead>{tt('Tarix', 'Date')}</TableHead><TableHead>{tt('Sətir', 'Lines')}</TableHead><TableHead>{tt('Status', 'Status')}</TableHead><TableHead className="w-28" /></TableRow></TableHeader>
            <TableBody>{data.map((dn) => (
              <TableRow key={dn.id}>
                <TableCell className="font-medium">{dn.deliveryNoteNumber}</TableCell>
                <TableCell>{dn.customerName ?? '—'}</TableCell>
                <TableCell className="text-muted-foreground">{dn.despatchDate}</TableCell>
                <TableCell>{dn.lineItems.length}</TableCell>
                <TableCell>{canEdit ? (
                  <Select value={dn.status} onValueChange={(v) => setDeliveryNoteStatus(dn, v as 'draft' | 'despatched' | 'delivered' | 'cancelled', profile?.uid ?? '').then(refresh)}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS).map(([k, v]) => <SelectItem key={k} value={k}>{tt(v[0], v[1])}</SelectItem>)}</SelectContent></Select>
                ) : <Badge variant="secondary">{tt(STATUS[dn.status][0], STATUS[dn.status][1])}</Badge>}</TableCell>
                <TableCell><div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => printDeliveryNote(dn, company)}><Printer className="h-3.5 w-3.5" /></Button>
                  {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => { if (confirm(tt('Silinsin?', 'Delete?'))) deleteDeliveryNote(dn, profile?.uid ?? '').then(refresh); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div></TableCell>
              </TableRow>))}</TableBody></Table></div></CardContent></Card>}
      {open && <DeliveryDialog companyId={companyId} cur={cur} actorUid={profile?.uid ?? ''} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refresh(); }} />}
    </div>
  );
}

function DeliveryDialog({ companyId, cur, actorUid, onClose, onSaved }: { companyId: string; cur: string; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const { data: invoices } = useQuery({ queryKey: ['invoices', companyId], queryFn: () => listInvoices(companyId) });
  const usable = useMemo(() => (invoices ?? []).filter((i) => i.status !== 'draft' && i.status !== 'cancelled'), [invoices]);
  const [invoiceId, setInvoiceId] = useState('');
  const [carrier, setCarrier] = useState(''); const [plate, setPlate] = useState(''); const [driver, setDriver] = useState('');
  const [saving, setSaving] = useState(false);
  const inv = usable.find((i) => i.id === invoiceId);

  async function save() {
    if (!inv) { toast.error(tt('Faktura seçin', 'Select an invoice')); return; }
    setSaving(true);
    try {
      await deliveryNoteFromInvoice(inv, actorUid, { carrier: carrier || null, vehiclePlate: plate || null, driverName: driver || null });
      toast.success(tt('Təhvil qaiməsi yaradıldı', 'Delivery note created'));
      onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{tt('Fakturadan təhvil qaiməsi', 'Delivery note from invoice')}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1"><Label>{tt('Faktura', 'Invoice')}</Label>
          <Select value={invoiceId} onValueChange={setInvoiceId}><SelectTrigger><SelectValue placeholder={tt('Faktura seçin', 'Select invoice')} /></SelectTrigger>
            <SelectContent>{usable.map((i) => <SelectItem key={i.id} value={i.id}>{i.invoiceNumber} · {i.customerName} · {formatCurrency(i.grandTotal, i.currency || cur)}</SelectItem>)}</SelectContent></Select></div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1"><Label>{tt('Daşıyıcı', 'Carrier')}</Label><Input value={carrier} onChange={(e) => setCarrier(e.target.value)} /></div>
          <div className="space-y-1"><Label>{tt('N/v', 'Plate')}</Label><Input value={plate} onChange={(e) => setPlate(e.target.value)} /></div>
          <div className="space-y-1"><Label>{tt('Sürücü', 'Driver')}</Label><Input value={driver} onChange={(e) => setDriver(e.target.value)} /></div>
        </div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button>
        <Button onClick={save} disabled={saving || !inv}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}

/* ─────────── CMR ─────────── */
function CmrTab({ company }: { company: Company }) {
  const tt = useTT();
  const qc = useQueryClient();
  const { profile, isSuperAdmin, can } = useAuth();
  const companyId = company.id;
  const canEdit = isSuperAdmin || can('sales.invoice.create') || can('warehouse.stock.view');
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['cmr', companyId], queryFn: () => listCmrConsignments(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['cmr', companyId] });

  return (
    <div className="mt-4">
      {canEdit && <div className="mb-3 flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni CMR', 'New CMR')}</Button></div>}
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : !data || data.length === 0 ? <EmptyState title={tt('CMR qaiməsi yoxdur', 'No CMR consignments')} />
        : <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>№</TableHead><TableHead>{tt('Növ', 'Kind')}</TableHead><TableHead>{tt('Göndərən', 'Sender')}</TableHead><TableHead>{tt('Alan', 'Consignee')}</TableHead><TableHead>{tt('Tarix', 'Date')}</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
            <TableBody>{data.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.cmrNumber}</TableCell>
                <TableCell><Badge variant={c.kind === 'international' ? 'default' : 'secondary'}>{c.kind === 'international' ? tt('Beynəlxalq', 'International') : tt('Yerli', 'Domestic')}</Badge></TableCell>
                <TableCell className="max-w-[160px] truncate">{c.senderName}</TableCell>
                <TableCell className="max-w-[160px] truncate">{c.consigneeName}</TableCell>
                <TableCell className="text-muted-foreground">{c.issueDate}</TableCell>
                <TableCell><div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => printCmr(c, company)}><Printer className="h-3.5 w-3.5" /></Button>
                  {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => { if (confirm(tt('Silinsin?', 'Delete?'))) deleteCmr(c, profile?.uid ?? '').then(refresh); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div></TableCell>
              </TableRow>))}</TableBody></Table></div></CardContent></Card>}
      {open && <CmrDialog companyId={companyId} actorUid={profile?.uid ?? ''} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refresh(); }} />}
    </div>
  );
}

function CmrDialog({ companyId, actorUid, onClose, onSaved }: { companyId: string; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [f, setF] = useState({
    kind: 'domestic' as CmrKind, issueDate: new Date().toISOString().slice(0, 10),
    senderName: '', senderAddress: '', consigneeName: '', consigneeAddress: '',
    placeOfLoading: '', placeOfDelivery: '', loadingDate: '', countryFrom: '', countryTo: '',
    carrierName: '', vehiclePlate: '', trailerPlate: '', driverName: '',
    goodsDescription: '', packages: '', grossWeightKg: '', volumeM3: '', notes: '',
  });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p }));
  async function save() {
    if (!f.senderName.trim() || !f.consigneeName.trim()) { toast.error(tt('Göndərən və alan məcburidir', 'Sender and consignee required')); return; }
    setSaving(true);
    try {
      await createCmr({
        companyId, kind: f.kind, issueDate: f.issueDate, senderName: f.senderName.trim(), senderAddress: f.senderAddress || null,
        consigneeName: f.consigneeName.trim(), consigneeAddress: f.consigneeAddress || null,
        placeOfLoading: f.placeOfLoading || null, placeOfDelivery: f.placeOfDelivery || null, loadingDate: f.loadingDate || null,
        countryFrom: f.kind === 'international' ? (f.countryFrom || null) : null, countryTo: f.kind === 'international' ? (f.countryTo || null) : null,
        carrierName: f.carrierName || null, vehiclePlate: f.vehiclePlate || null, trailerPlate: f.trailerPlate || null, driverName: f.driverName || null,
        goodsDescription: f.goodsDescription || null, packages: f.packages ? Number(f.packages) : null,
        grossWeightKg: f.grossWeightKg ? Number(f.grossWeightKg) : null, volumeM3: f.volumeM3 ? Number(f.volumeM3) : null,
        sourceDeliveryNoteId: null, notes: f.notes || null, createdBy: actorUid,
      });
      toast.success(tt('CMR yaradıldı', 'CMR created'));
      onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>{tt('Yeni CMR qaiməsi', 'New CMR consignment')}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1"><Label>{tt('Növ', 'Kind')}</Label>
          <Select value={f.kind} onValueChange={(v) => set({ kind: v as CmrKind })}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="domestic">{tt('Yerli', 'Domestic')}</SelectItem><SelectItem value="international">{tt('Beynəlxalq', 'International')}</SelectItem></SelectContent></Select></div>
        <div className="space-y-1"><Label>{tt('Tarix', 'Date')}</Label><Input type="date" value={f.issueDate} onChange={(e) => set({ issueDate: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Göndərən *', 'Sender *')}</Label><Input value={f.senderName} onChange={(e) => set({ senderName: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Göndərənin ünvanı', 'Sender address')}</Label><Input value={f.senderAddress} onChange={(e) => set({ senderAddress: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Alan *', 'Consignee *')}</Label><Input value={f.consigneeName} onChange={(e) => set({ consigneeName: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Alanın ünvanı', 'Consignee address')}</Label><Input value={f.consigneeAddress} onChange={(e) => set({ consigneeAddress: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Yükləmə yeri', 'Place of loading')}</Label><Input value={f.placeOfLoading} onChange={(e) => set({ placeOfLoading: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Boşaltma yeri', 'Place of delivery')}</Label><Input value={f.placeOfDelivery} onChange={(e) => set({ placeOfDelivery: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Yükləmə tarixi', 'Loading date')}</Label><Input type="date" value={f.loadingDate} onChange={(e) => set({ loadingDate: e.target.value })} /></div>
        {f.kind === 'international' && <>
          <div className="space-y-1"><Label>{tt('Göndərən ölkə', 'Country from')}</Label><Input value={f.countryFrom} onChange={(e) => set({ countryFrom: e.target.value })} /></div>
          <div className="space-y-1"><Label>{tt('Təyinat ölkə', 'Country to')}</Label><Input value={f.countryTo} onChange={(e) => set({ countryTo: e.target.value })} /></div>
        </>}
        <div className="space-y-1"><Label>{tt('Daşıyıcı', 'Carrier')}</Label><Input value={f.carrierName} onChange={(e) => set({ carrierName: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('N/v nömrəsi', 'Vehicle plate')}</Label><Input value={f.vehiclePlate} onChange={(e) => set({ vehiclePlate: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Qoşqu nömrəsi', 'Trailer plate')}</Label><Input value={f.trailerPlate} onChange={(e) => set({ trailerPlate: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Sürücü', 'Driver')}</Label><Input value={f.driverName} onChange={(e) => set({ driverName: e.target.value })} /></div>
        <div className="space-y-1 sm:col-span-2"><Label>{tt('Yükün təsviri', 'Goods description')}</Label><Input value={f.goodsDescription} onChange={(e) => set({ goodsDescription: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Yerlərin sayı', 'Packages')}</Label><Input type="number" value={f.packages} onChange={(e) => set({ packages: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Brutto çəki (kq)', 'Gross weight (kg)')}</Label><Input type="number" value={f.grossWeightKg} onChange={(e) => set({ grossWeightKg: e.target.value })} /></div>
        <div className="space-y-1"><Label>{tt('Həcm (m³)', 'Volume (m³)')}</Label><Input type="number" value={f.volumeM3} onChange={(e) => set({ volumeM3: e.target.value })} /></div>
        <div className="space-y-1 sm:col-span-2"><Label>{tt('Qeyd', 'Notes')}</Label><Input value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}

/* ─────────── Remittance advice ─────────── */
function RemittanceTab({ company }: { company: Company }) {
  const tt = useTT();
  const qc = useQueryClient();
  const { profile, isSuperAdmin, can } = useAuth();
  const companyId = company.id;
  const cur = company.baseCurrency ?? 'AZN';
  const canEdit = isSuperAdmin || can('cashbank.transaction.view');
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['remittance', companyId], queryFn: () => listRemittanceAdvices(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['remittance', companyId] });

  return (
    <div className="mt-4">
      {canEdit && <div className="mb-3 flex justify-end"><Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni məktub', 'New advice')}</Button></div>}
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : !data || data.length === 0 ? <EmptyState title={tt('Ödəniş məktubu yoxdur', 'No remittance advices')} />
        : <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>№</TableHead><TableHead>{tt('Təchizatçı', 'Vendor')}</TableHead><TableHead>{tt('Tarix', 'Date')}</TableHead><TableHead className="text-right">{tt('Məbləğ', 'Amount')}</TableHead><TableHead className="w-20" /></TableRow></TableHeader>
            <TableBody>{data.map((ra) => (
              <TableRow key={ra.id}>
                <TableCell className="font-medium">{ra.adviceNumber}</TableCell>
                <TableCell>{ra.vendorName}</TableCell>
                <TableCell className="text-muted-foreground">{ra.paymentDate}</TableCell>
                <TableCell className="text-right tnum font-semibold">{formatCurrency(ra.totalAmount, ra.currency)}</TableCell>
                <TableCell><div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => printRemittance(ra, company)}><Printer className="h-3.5 w-3.5" /></Button>
                  {canEdit && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => { if (confirm(tt('Silinsin?', 'Delete?'))) deleteRemittanceAdvice(ra, profile?.uid ?? '').then(refresh); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </div></TableCell>
              </TableRow>))}</TableBody></Table></div></CardContent></Card>}
      {open && <RemittanceDialog companyId={companyId} cur={cur} actorUid={profile?.uid ?? ''} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refresh(); }} />}
    </div>
  );
}

function RemittanceDialog({ companyId, cur, actorUid, onClose, onSaved }: { companyId: string; cur: string; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [vendorName, setVendorName] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState('bank'); const [ref, setRef] = useState('');
  const [rows, setRows] = useState<{ billNumber: string; billDate: string; amount: string }[]>([{ billNumber: '', billDate: '', amount: '' }]);
  const [saving, setSaving] = useState(false);
  const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const setRow = (i: number, p: Partial<typeof rows[number]>) => setRows((rs) => rs.map((r, j) => j === i ? { ...r, ...p } : r));

  async function save() {
    const alloc = rows.filter((r) => r.billNumber.trim() && Number(r.amount) > 0);
    if (!vendorName.trim() || alloc.length === 0) { toast.error(tt('Təchizatçı və ən azı bir sətir lazımdır', 'Vendor and at least one line required')); return; }
    setSaving(true);
    try {
      await createRemittanceAdvice({
        companyId, vendorId: null, vendorName: vendorName.trim(), paymentDate, paymentMethod: method, bankReference: ref || null, currency: cur,
        allocations: alloc.map((r) => ({ billId: null, billNumber: r.billNumber.trim(), billDate: r.billDate || null, amount: Number(r.amount) })),
        notes: null, createdBy: actorUid,
      });
      toast.success(tt('Ödəniş məktubu yaradıldı', 'Remittance advice created'));
      onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{tt('Yeni ödəniş məktubu', 'New remittance advice')}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1"><Label>{tt('Təchizatçı *', 'Vendor *')}</Label><Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} /></div>
          <div className="space-y-1"><Label>{tt('Ödəniş tarixi', 'Payment date')}</Label><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
          <div className="space-y-1"><Label>{tt('Üsul', 'Method')}</Label>
            <Select value={method} onValueChange={setMethod}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="bank">{tt('Bank', 'Bank')}</SelectItem><SelectItem value="cash">{tt('Kassa', 'Cash')}</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><Label>{tt('Bank istinadı', 'Bank reference')}</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} /></div>
        </div>
        <div>
          <Label>{tt('Fakturalar', 'Bills')}</Label>
          <div className="mt-1 space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_120px_120px_auto] gap-2">
                <Input placeholder={tt('Faktura №', 'Bill №')} value={r.billNumber} onChange={(e) => setRow(i, { billNumber: e.target.value })} />
                <Input type="date" value={r.billDate} onChange={(e) => setRow(i, { billDate: e.target.value })} />
                <Input type="number" placeholder={tt('Məbləğ', 'Amount')} value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} />
                <Button variant="ghost" size="icon" className="h-9 w-9 text-rose-600" onClick={() => setRows((rs) => rs.length > 1 ? rs.filter((_, j) => j !== i) : rs)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <Button variant="outline" size="sm" onClick={() => setRows((rs) => [...rs, { billNumber: '', billDate: '', amount: '' }])}><Plus className="h-3.5 w-3.5" /> {tt('Sətir', 'Row')}</Button>
            <span className="text-sm font-semibold">{tt('Cəm', 'Total')}: {formatCurrency(total, cur)}</span>
          </div>
        </div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}
