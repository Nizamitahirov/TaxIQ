'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Send, Ban, Printer, FileText, FileCode2, Receipt, Zap } from 'lucide-react';
import {
  listInvoices, listCustomers, createInvoice, postInvoice, cancelInvoice,
  listDocumentTemplates, markEInvoiceSubmitted, refreshOverdue, getCustomer,
} from '@/lib/firebase/sales';
import { downloadEInvoiceXml } from '@/lib/sales/einvoice';
import { printWithTemplate, buildInvoiceContext } from '@/lib/sales/document-template';
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { LineItemsEditor, emptyLine, type DraftLine } from './line-items-editor';
import { printInvoice } from './print-invoice';
import type { Company, Invoice, InvoiceStatus, Customer } from '@/types';

const STATUS: Record<InvoiceStatus, { label: string; en: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }> = {
  draft: { label: 'qaralama', en: 'draft', variant: 'secondary' },
  sent: { label: 'göndərilib', en: 'sent', variant: 'default' },
  partially_paid: { label: 'qismən ödənilib', en: 'partially paid', variant: 'warning' },
  paid: { label: 'ödənilib', en: 'paid', variant: 'success' },
  overdue: { label: 'vaxtı keçib', en: 'overdue', variant: 'destructive' },
  cancelled: { label: 'ləğv', en: 'cancelled', variant: 'secondary' },
};

export function InvoicesTab({ companyId, canCreate, actorUid, baseCurrency, company }: {
  companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string; company: Company;
}) {
  const qc = useQueryClient();
  const tt = useTT();
  const [open, setOpen] = useState(false);
  const [posOpen, setPosOpen] = useState(false);
  const [stsFor, setStsFor] = useState<Invoice | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['invoices', companyId], queryFn: () => listInvoices(companyId) });
  const { data: customers } = useQuery({ queryKey: ['customers', companyId], queryFn: () => listCustomers(companyId) });
  const { data: templates } = useQuery({ queryKey: ['documentTemplates', companyId], queryFn: () => listDocumentTemplates(companyId) });

  // Vaxtı keçmiş fakturaları avtomatik yenilə (06 §3.2) — Cloud Scheduler alternativi
  useEffect(() => { refreshOverdue(companyId).then((n) => { if (n > 0) qc.invalidateQueries({ queryKey: ['invoices', companyId] }); }).catch(() => {}); }, [companyId, qc]);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['invoices', companyId] });
    qc.invalidateQueries({ queryKey: ['journal', companyId] });
    qc.invalidateQueries({ queryKey: ['trial', companyId] });
    qc.invalidateQueries({ queryKey: ['aging', companyId] });
  }

  const defaultTemplate = (templates ?? []).find((t) => t.type === 'invoice' && t.isDefault);
  async function print(inv: Invoice) {
    if (defaultTemplate) {
      const customer = customers?.find((c) => c.id === inv.customerId) ?? null;
      printWithTemplate(defaultTemplate.htmlContent, buildInvoiceContext(inv, company, customer as Customer | null));
    } else { printInvoice(inv, company); }
  }
  async function eInvoice(inv: Invoice) {
    const customer = customers?.find((c) => c.id === inv.customerId) ?? (await getCustomer(inv.customerId));
    downloadEInvoiceXml(inv, company, (customer as Customer) ?? null);
    toast.success(tt('e-Qaimə XML endirildi', 'e-Invoice XML downloaded'), tt('e-taxes.gov.az-a əl ilə yükləyin, sonra STS nömrəsini daxil edin', 'Upload it manually to e-taxes.gov.az, then enter the STS number'));
    setStsFor(inv);
  }

  async function post(inv: Invoice) {
    setBusyId(inv.id);
    try { await postInvoice(inv, baseCurrency, actorUid); toast.success(tt('Faktura rəsmiləşdi', 'Invoice posted'), tt('Satış jurnal yazısı yaradıldı', 'Sales journal entry created')); invalidate(); }
    catch (e) { toast.error(tt('Alınmadı', 'Failed'), e instanceof Error ? e.message : undefined); }
    finally { setBusyId(null); }
  }
  async function cancel(inv: Invoice) {
    setBusyId(inv.id);
    try { await cancelInvoice(inv, actorUid); toast.success(tt('Faktura ləğv edildi', 'Invoice cancelled')); invalidate(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusyId(null); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <ExportButton filename="fakturalar" rows={data ?? []}
          columns={[
            { header: tt('Nömrə', 'Number'), value: 'invoiceNumber' }, { header: tt('Müştəri', 'Customer'), value: (i) => i.customerName ?? '' },
            { header: tt('Tarix', 'Date'), value: 'issueDate' }, { header: tt('Ödəmə tarixi', 'Due date'), value: 'dueDate' },
            { header: tt('Yekun', 'Total'), value: 'grandTotal' }, { header: tt('Ödənilib', 'Paid'), value: 'amountPaid' },
            { header: tt('Qalıq', 'Balance'), value: 'amountDue' }, { header: 'Status', value: 'status' },
          ]} />
        <div className="flex gap-2">
          {canCreate && <Button size="sm" variant="outline" onClick={() => setPosOpen(true)} disabled={!customers || customers.length === 0}><Zap className="h-4 w-4" /> {tt('Sürətli satış', 'Quick sale')}</Button>}
          {canCreate && <Button size="sm" onClick={() => setOpen(true)} disabled={!customers || customers.length === 0}><Plus className="h-4 w-4" /> {tt('Yeni faktura', 'New invoice')}</Button>}
        </div>
      </div>
      {(!customers || customers.length === 0) && <p className="mb-3 text-xs text-warning-foreground">{tt('Əvvəlcə «Müştərilər» bölməsindən müştəri əlavə edin.', 'First add a customer from the “Customers” tab.')}</p>}

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Faktura yoxdur', 'No invoices')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{tt('Nömrə', 'Number')}</TableHead><TableHead>{tt('Müştəri', 'Customer')}</TableHead><TableHead>{tt('Ödəmə tarixi', 'Due date')}</TableHead>
              <TableHead className="text-right">{tt('Yekun', 'Total')}</TableHead><TableHead className="text-right">{tt('Qalıq', 'Balance')}</TableHead>
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
                  <TableCell>
                    <Badge variant={STATUS[inv.status].variant}>{tt(STATUS[inv.status].label, STATUS[inv.status].en)}</Badge>
                    {inv.eInvoice?.submittedToSTS && <Badge variant="outline" className="ml-1" title={`STS: ${inv.eInvoice.stsReferenceNumber ?? ''}`}>{tt('e-qaimə', 'e-invoice')}</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={tt('Çap', 'Print')} onClick={() => print(inv)}><Printer className="h-4 w-4" /></Button>
                      {canCreate && inv.status === 'draft' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" title={tt('Rəsmiləşdir', 'Post')} disabled={busyId === inv.id} onClick={() => post(inv)}>
                          {busyId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><FileCode2 className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => eInvoice(inv)}><FileCode2 className="h-4 w-4" /> {tt('e-Qaimə XML endir', 'Download e-Invoice XML')}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setStsFor(inv)}><Receipt className="h-4 w-4" /> {tt('STS nömrəsi daxil et', 'Enter STS number')}</DropdownMenuItem>
                          {canCreate && !['paid', 'cancelled'].includes(inv.status) && <DropdownMenuItem onClick={() => cancel(inv)} className="text-danger"><Ban className="h-4 w-4" /> {tt('Ləğv et', 'Cancel')}</DropdownMenuItem>}
                        </DropdownMenuContent>
                      </DropdownMenu>
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
      {canCreate && posOpen && <QuickSaleDialog companyId={companyId} actorUid={actorUid} baseCurrency={baseCurrency} company={company}
        customers={customers ?? []} onClose={() => setPosOpen(false)} onSaved={invalidate} onPrint={print} />}
      {stsFor && <StsDialog invoice={stsFor} actorUid={actorUid} onClose={() => setStsFor(null)} onSaved={invalidate} />}
    </div>
  );
}

function StsDialog({ invoice, actorUid, onClose, onSaved }: { invoice: Invoice; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [ref, setRef] = useState(invoice.eInvoice?.stsReferenceNumber ?? '');
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!ref.trim()) { toast.error(tt('STS nömrəsi tələb olunur', 'STS number is required')); return; }
    setBusy(true);
    try { await markEInvoiceSubmitted(invoice, ref.trim(), actorUid); toast.success(tt('e-Qaimə STS-ə təqdim edilmiş kimi işarələndi', 'e-Invoice marked as submitted to STS')); onSaved(); onClose(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{tt('e-Qaimə — STS qeydiyyat nömrəsi', 'e-Invoice — STS registration number')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{tt('XML faylını e-taxes.gov.az-a ASAN İmza ilə yüklədikdən sonra STS-dən aldığınız təsdiq nömrəsini daxil edin (06 §5).', 'After uploading the XML file to e-taxes.gov.az with ASAN Signature, enter the confirmation number you received from STS (06 §5).')}</p>
          <div className="space-y-2"><Label>{tt('STS nömrəsi', 'STS number')}</Label><Input value={ref} onChange={(e) => setRef(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Receipt className="h-4 w-4" />} {tt('Təsdiq et', 'Confirm')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuickSaleDialog({ companyId, actorUid, baseCurrency, company, customers, onClose, onSaved, onPrint }: {
  companyId: string; actorUid: string; baseCurrency: string; company: Company;
  customers: { id: string; name: string; paymentTermDays?: number }[]; onClose: () => void; onSaved: () => void; onPrint: (inv: Invoice) => void;
}) {
  const tt = useTT();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? '');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [busy, setBusy] = useState(false);

  async function sell() {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) { toast.error(tt('Müştəri seçin', 'Select a customer')); return; }
    const valid = lines.filter((l) => l.description && l.unitPrice > 0);
    if (valid.length === 0) { toast.error(tt('Ən azı 1 sətir', 'At least 1 line')); return; }
    setBusy(true);
    try {
      const id = await createInvoice({ companyId, customerId, customerName: customer.name, issueDate: new Date().toISOString().slice(0, 10), paymentTermDays: 0, currency: baseCurrency, lineItems: valid, createdBy: actorUid });
      const inv = await (await import('@/lib/firebase/sales')).listInvoices(companyId);
      const created = inv.find((x) => x.id === id);
      if (created) { await postInvoice(created, baseCurrency, actorUid); onPrint({ ...created, status: 'sent' }); }
      toast.success(tt('Satış tamamlandı', 'Sale completed'), tt('Faktura rəsmiləşdi və çap edildi', 'The invoice was posted and printed'));
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary" /> {tt('Sürətli satış (POS)', 'Quick sale (POS)')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>{tt('Müştəri', 'Customer')}</Label>
            <Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
              <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <LineItemsEditor lines={lines} onChange={setLines} currency={baseCurrency} />
          <p className="text-xs text-muted-foreground">{tt('«Sat və çap et» faktura yaradır, dərhal rəsmiləşdirir (jurnal yazısı) və çap edir.', '“Sell & print” creates the invoice, posts it immediately (journal entry) and prints it.')}</p>
        </div>
        <DialogFooter><Button onClick={sell} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Receipt className="h-4 w-4" />} {tt('Sat və çap et', 'Sell & print')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewInvoiceDialog({ open, onOpenChange, companyId, actorUid, baseCurrency, customers, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; baseCurrency: string;
  customers: { id: string; name: string; paymentTermDays?: number }[]; onSaved: () => void;
}) {
  const tt = useTT();
  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  async function save() {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) { toast.error(tt('Müştəri seçin', 'Select a customer')); return; }
    const valid = lines.filter((l) => l.description && l.unitPrice > 0);
    if (valid.length === 0) { toast.error(tt('Ən azı 1 sətir daxil edin', 'Enter at least 1 line')); return; }
    setSaving(true);
    try {
      await createInvoice({
        companyId, customerId, customerName: customer.name, issueDate,
        paymentTermDays: customer.paymentTermDays ?? 0, currency: baseCurrency, lineItems: valid, createdBy: actorUid,
      });
      toast.success(tt('Faktura yaradıldı (qaralama)', 'Invoice created (draft)'), tt('Rəsmiləşdirmək üçün «göndər» düyməsinə basın', 'Press “send” to post it'));
      setCustomerId(''); setLines([emptyLine()]);
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> {tt('Yeni faktura', 'New invoice')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label>{tt('Müştəri', 'Customer')}</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder={tt('Müştəri seç', 'Select customer')} /></SelectTrigger>
                <SelectContent>{customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>{tt('Tarix', 'Date')}</Label><Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></div>
          </div>
          <LineItemsEditor lines={lines} onChange={setLines} currency={baseCurrency} />
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
