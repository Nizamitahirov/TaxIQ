'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Send, Ban, Printer, FileText } from 'lucide-react';
import {
  listInvoices, listCustomers, createInvoice, postInvoice, cancelInvoice,
} from '@/lib/firebase/sales';
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
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { LineItemsEditor, emptyLine, type DraftLine } from './line-items-editor';
import { printInvoice } from './print-invoice';
import type { Company, Invoice, InvoiceStatus } from '@/types';

const STATUS: Record<InvoiceStatus, { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }> = {
  draft: { label: 'qaralama', variant: 'secondary' },
  sent: { label: 'göndərilib', variant: 'default' },
  partially_paid: { label: 'qismən ödənilib', variant: 'warning' },
  paid: { label: 'ödənilib', variant: 'success' },
  overdue: { label: 'vaxtı keçib', variant: 'destructive' },
  cancelled: { label: 'ləğv', variant: 'secondary' },
};

export function InvoicesTab({ companyId, canCreate, actorUid, baseCurrency, company }: {
  companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string; company: Company;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['invoices', companyId], queryFn: () => listInvoices(companyId) });
  const { data: customers } = useQuery({ queryKey: ['customers', companyId], queryFn: () => listCustomers(companyId) });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['invoices', companyId] });
    qc.invalidateQueries({ queryKey: ['journal', companyId] });
    qc.invalidateQueries({ queryKey: ['trial', companyId] });
    qc.invalidateQueries({ queryKey: ['aging', companyId] });
  }

  async function post(inv: Invoice) {
    setBusyId(inv.id);
    try { await postInvoice(inv, baseCurrency, actorUid); toast.success('Faktura rəsmiləşdi', 'Satış jurnal yazısı yaradıldı'); invalidate(); }
    catch (e) { toast.error('Alınmadı', e instanceof Error ? e.message : undefined); }
    finally { setBusyId(null); }
  }
  async function cancel(inv: Invoice) {
    setBusyId(inv.id);
    try { await cancelInvoice(inv, actorUid); toast.success('Faktura ləğv edildi'); invalidate(); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusyId(null); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <ExportButton filename="fakturalar" rows={data ?? []}
          columns={[
            { header: 'Nömrə', value: 'invoiceNumber' }, { header: 'Müştəri', value: (i) => i.customerName ?? '' },
            { header: 'Tarix', value: 'issueDate' }, { header: 'Ödəmə tarixi', value: 'dueDate' },
            { header: 'Yekun', value: 'grandTotal' }, { header: 'Ödənilib', value: 'amountPaid' },
            { header: 'Qalıq', value: 'amountDue' }, { header: 'Status', value: 'status' },
          ]} />
        {canCreate && <Button size="sm" onClick={() => setOpen(true)} disabled={!customers || customers.length === 0}><Plus className="h-4 w-4" /> Yeni faktura</Button>}
      </div>
      {(!customers || customers.length === 0) && <p className="mb-3 text-xs text-warning-foreground">Əvvəlcə «Müştərilər» bölməsindən müştəri əlavə edin.</p>}

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Faktura yoxdur" />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nömrə</TableHead><TableHead>Müştəri</TableHead><TableHead>Ödəmə tarixi</TableHead>
              <TableHead className="text-right">Yekun</TableHead><TableHead className="text-right">Qalıq</TableHead>
              <TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-sm font-medium">{inv.invoiceNumber}</TableCell>
                  <TableCell>{inv.customerName}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(new Date(inv.dueDate).getTime())}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(inv.grandTotal, inv.currency)}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(inv.amountDue, inv.currency)}</TableCell>
                  <TableCell><Badge variant={STATUS[inv.status].variant}>{STATUS[inv.status].label}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Çap" onClick={() => printInvoice(inv, company)}><Printer className="h-4 w-4" /></Button>
                      {canCreate && inv.status === 'draft' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title="Rəsmiləşdir" disabled={busyId === inv.id} onClick={() => post(inv)}>
                          {busyId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      )}
                      {canCreate && !['paid', 'cancelled'].includes(inv.status) && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" title="Ləğv et" disabled={busyId === inv.id} onClick={() => cancel(inv)}><Ban className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      {canCreate && <NewInvoiceDialog open={open} onOpenChange={setOpen} companyId={companyId} actorUid={actorUid} baseCurrency={baseCurrency}
        customers={customers ?? []} onSaved={invalidate} />}
    </div>
  );
}

function NewInvoiceDialog({ open, onOpenChange, companyId, actorUid, baseCurrency, customers, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; baseCurrency: string;
  customers: { id: string; name: string; paymentTermDays?: number }[]; onSaved: () => void;
}) {
  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  async function save() {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) { toast.error('Müştəri seçin'); return; }
    const valid = lines.filter((l) => l.description && l.unitPrice > 0);
    if (valid.length === 0) { toast.error('Ən azı 1 sətir daxil edin'); return; }
    setSaving(true);
    try {
      await createInvoice({
        companyId, customerId, customerName: customer.name, issueDate,
        paymentTermDays: customer.paymentTermDays ?? 0, currency: baseCurrency, lineItems: valid, createdBy: actorUid,
      });
      toast.success('Faktura yaradıldı (qaralama)', 'Rəsmiləşdirmək üçün «göndər» düyməsinə basın');
      setCustomerId(''); setLines([emptyLine()]);
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Yeni faktura</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label>Müştəri</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Müştəri seç" /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Tarix</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
          </div>
          <LineItemsEditor lines={lines} onChange={setLines} currency={baseCurrency} />
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Yarat</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
