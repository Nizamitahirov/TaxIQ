'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Check } from 'lucide-react';
import {
  listVendors, createVendor, listPurchaseBills, createPurchaseBill, approveBill,
} from '@/lib/firebase/treasury';
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
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency } from '@/lib/utils/format';
import { LineItemsEditor, emptyLine, type DraftLine } from '../sales/line-items-editor';
import type { PurchaseBill } from '@/types';

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function PurchasesTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const tt = useTT();
  const [vOpen, setVOpen] = useState(false);
  const [bOpen, setBOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data: vendors } = useQuery({ queryKey: ['vendors', companyId], queryFn: () => listVendors(companyId) });
  const { data: bills, isLoading } = useQuery({ queryKey: ['purchaseBills', companyId], queryFn: () => listPurchaseBills(companyId) });

  async function approve(b: PurchaseBill) {
    setBusyId(b.id);
    try { await approveBill(b, baseCurrency, actorUid); toast.success(tt('Təsdiqləndi', 'Approved'), tt('Kreditor jurnal yazısı yaradıldı', 'Payables journal entry created')); qc.invalidateQueries({ queryKey: ['purchaseBills', companyId] }); qc.invalidateQueries({ queryKey: ['journal', companyId] }); qc.invalidateQueries({ queryKey: ['trial', companyId] }); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusyId(null); }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{tt('Təchizatçılar', 'Suppliers')}</h3>
          {canCreate && <Button size="sm" variant="outline" onClick={() => setVOpen(true)}><Plus className="h-4 w-4" /> {tt('Təchizatçı', 'Supplier')}</Button>}
        </div>
        <div className="flex flex-wrap gap-2">
          {(vendors ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{tt('Təchizatçı yoxdur', 'No suppliers')}</p> : (vendors ?? []).map((v) => (
            <span key={v.id} className="rounded-full border border-border bg-card px-3 py-1 text-sm">{v.name}{v.taxId ? ` · ${v.taxId}` : ''}</span>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{tt('Kreditor fakturalar', 'Purchase bills')}</h3>
          <div className="flex gap-2">
            <ExportButton filename="kreditor-fakturalar" rows={bills ?? []}
              columns={[{ header: tt('Nömrə', 'Number'), value: 'billNumber' }, { header: tt('Təchizatçı', 'Supplier'), value: (b) => b.vendorName ?? '' }, { header: tt('Yekun', 'Total'), value: 'grandTotal' }, { header: tt('Qalıq', 'Balance'), value: 'amountDue' }, { header: 'Status', value: 'status' }]} />
            {canCreate && <Button size="sm" onClick={() => setBOpen(true)} disabled={!vendors || vendors.length === 0}><Plus className="h-4 w-4" /> {tt('Kreditor faktura', 'Purchase bill')}</Button>}
          </div>
        </div>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (bills ?? []).length === 0 ? <EmptyState title={tt('Kreditor faktura yoxdur', 'No purchase bills')} /> : (
          <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{tt('Nömrə', 'Number')}</TableHead><TableHead>{tt('Təchizatçı', 'Supplier')}</TableHead><TableHead className="text-right">{tt('Yekun', 'Total')}</TableHead><TableHead className="text-right">{tt('Qalıq', 'Balance')}</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {(bills ?? []).map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-sm">{b.billNumber}</TableCell>
                    <TableCell>{b.vendorName}</TableCell>
                    <TableCell className="text-right tnum">{formatCurrency(b.grandTotal, b.currency)}</TableCell>
                    <TableCell className="text-right tnum">{formatCurrency(b.amountDue, b.currency)}</TableCell>
                    <TableCell><Badge variant={b.status === 'paid' ? 'success' : b.status === 'draft' ? 'secondary' : 'default'}>{b.status}</Badge></TableCell>
                    <TableCell className="text-right">{canCreate && b.status === 'draft' && <Button variant="outline" size="sm" disabled={busyId === b.id} onClick={() => approve(b)}>{busyId === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {tt('Təsdiqlə', 'Approve')}</Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}
      </div>

      <VendorDialog open={vOpen} onOpenChange={setVOpen} companyId={companyId} baseCurrency={baseCurrency} onSaved={() => qc.invalidateQueries({ queryKey: ['vendors', companyId] })} />
      {canCreate && <BillDialog open={bOpen} onOpenChange={setBOpen} companyId={companyId} actorUid={actorUid} baseCurrency={baseCurrency} vendors={vendors ?? []} onSaved={() => qc.invalidateQueries({ queryKey: ['purchaseBills', companyId] })} />}
    </div>
  );
}

function VendorDialog({ open, onOpenChange, companyId, baseCurrency, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; companyId: string; baseCurrency: string; onSaved: () => void }) {
  const tt = useTT();
  const [name, setName] = useState(''); const [taxId, setTaxId] = useState(''); const [iban, setIban] = useState(''); const [term, setTerm] = useState('30'); const [saving, setSaving] = useState(false);
  async function save() {
    if (!name.trim()) { toast.error(tt('Ad tələb olunur', 'Name is required')); return; }
    setSaving(true);
    try {
      await createVendor({ companyId, name: name.trim(), taxId: taxId.trim() || null, iban: iban.trim(), defaultCurrency: baseCurrency, paymentTermDays: Number(term) || 0, isActive: true } as Parameters<typeof createVendor>[0]);
      toast.success(tt('Təchizatçı əlavə edildi', 'Supplier added')); setName(''); setTaxId(''); setIban(''); onSaved(); onOpenChange(false);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tt('Yeni təchizatçı', 'New supplier')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>{tt('Ad', 'Name')}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>VÖEN</Label><Input value={taxId} onChange={(e) => setTaxId(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Ödəniş müddəti', 'Payment term')}</Label><Input type="number" value={term} onChange={(e) => setTerm(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>{tt('IBAN (ödəniş faylı üçün)', 'IBAN (for payment file)')}</Label><Input value={iban} onChange={(e) => setIban(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Əlavə et', 'Add')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BillDialog({ open, onOpenChange, companyId, actorUid, baseCurrency, vendors, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; baseCurrency: string; vendors: { id: string; name: string; paymentTermDays?: number }[]; onSaved: () => void;
}) {
  const tt = useTT();
  const [vendorId, setVendorId] = useState(''); const [ref, setRef] = useState(''); const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]); const [saving, setSaving] = useState(false);
  async function save() {
    const v = vendors.find((x) => x.id === vendorId);
    if (!v) { toast.error(tt('Təchizatçı seçin', 'Select a supplier')); return; }
    const valid = lines.filter((l) => l.description && l.unitPrice > 0);
    if (valid.length === 0) { toast.error(tt('Ən azı 1 sətir', 'At least 1 line')); return; }
    setSaving(true);
    try {
      await createPurchaseBill({ companyId, vendorId, vendorName: v.name, vendorInvoiceReference: ref, issueDate, paymentTermDays: v.paymentTermDays ?? 0, currency: baseCurrency, lineItems: valid, createdBy: actorUid });
      toast.success(tt('Kreditor faktura yaradıldı (draft)', 'Purchase bill created (draft)'), tt('Təsdiqləmək üçün «təsdiqlə» düyməsinə basın', 'Press “approve” to approve it'));
      setVendorId(''); setRef(''); setLines([emptyLine()]); onSaved(); onOpenChange(false);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{tt('Yeni kreditor faktura', 'New purchase bill')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2"><Label>{tt('Təchizatçı', 'Supplier')}</Label>
              <Select value={vendorId} onValueChange={setVendorId}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
                <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>{tt('Təchizatçı faktura №', 'Supplier invoice №')}</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Tarix', 'Date')}</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
          </div>
          <LineItemsEditor lines={lines} onChange={setLines} currency={baseCurrency} />
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
