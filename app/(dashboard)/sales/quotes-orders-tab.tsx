'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, ArrowRight, FileText } from 'lucide-react';
import {
  listQuotes, listOrders, listCustomers, createQuote, convertQuoteToOrder, convertOrderToInvoice, getCustomer,
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
import { formatCurrency } from '@/lib/utils/format';
import { LineItemsEditor, emptyLine, type DraftLine } from './line-items-editor';
import type { SalesOrder, SalesQuote } from '@/types';

export function QuotesOrdersTab({ companyId, canCreate, actorUid, baseCurrency }: {
  companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data: quotes, isLoading: lq } = useQuery({ queryKey: ['quotes', companyId], queryFn: () => listQuotes(companyId) });
  const { data: orders, isLoading: lo } = useQuery({ queryKey: ['orders', companyId], queryFn: () => listOrders(companyId) });
  const { data: customers } = useQuery({ queryKey: ['customers', companyId], queryFn: () => listCustomers(companyId) });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['quotes', companyId] });
    qc.invalidateQueries({ queryKey: ['orders', companyId] });
    qc.invalidateQueries({ queryKey: ['invoices', companyId] });
  }

  async function toOrder(q: SalesQuote) {
    setBusyId(q.id);
    try { await convertQuoteToOrder(q, actorUid); toast.success('Sifarişə çevrildi'); invalidate(); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusyId(null); }
  }
  async function toInvoice(o: SalesOrder) {
    setBusyId(o.id);
    try {
      const customer = await getCustomer(o.customerId);
      await convertOrderToInvoice(o, customer, actorUid);
      toast.success('Fakturaya çevrildi', 'Fakturalar bölməsində rəsmiləşdirin');
      invalidate();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusyId(null); }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Kommersiya təklifləri</h3>
          <div className="flex items-center gap-2">
            <ExportButton filename="teklifler" rows={quotes ?? []} columns={[
              { header: 'Nömrə', value: 'quoteNumber' }, { header: 'Müştəri', value: 'customerName' },
              { header: 'Yekun', value: 'grandTotal' }, { header: 'Valyuta', value: 'currency' }, { header: 'Status', value: 'status' },
            ]} />
            {canCreate && <Button size="sm" onClick={() => setOpen(true)} disabled={!customers || customers.length === 0}><Plus className="h-4 w-4" /> Yeni təklif</Button>}
          </div>
        </div>
        {lq ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (quotes ?? []).length === 0 ? <EmptyState title="Təklif yoxdur" /> : (
          <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Nömrə</TableHead><TableHead>Müştəri</TableHead><TableHead className="text-right">Yekun</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {(quotes ?? []).map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-sm">{q.quoteNumber}</TableCell>
                    <TableCell>{q.customerName}</TableCell>
                    <TableCell className="text-right tnum">{formatCurrency(q.grandTotal, q.currency)}</TableCell>
                    <TableCell><Badge variant={q.status === 'converted_to_order' ? 'success' : 'secondary'}>{q.status}</Badge></TableCell>
                    <TableCell className="text-right">{canCreate && q.status !== 'converted_to_order' && <Button variant="outline" size="sm" disabled={busyId === q.id} onClick={() => toOrder(q)}>{busyId === q.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Sifarişə</Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">Satış sifarişləri</h3>
          <ExportButton filename="sifarisler" rows={orders ?? []} columns={[
            { header: 'Nömrə', value: 'orderNumber' }, { header: 'Müştəri', value: 'customerName' },
            { header: 'Yekun', value: 'grandTotal' }, { header: 'Valyuta', value: 'currency' }, { header: 'Status', value: 'status' },
          ]} />
        </div>
        {lo ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (orders ?? []).length === 0 ? <EmptyState title="Sifariş yoxdur" /> : (
          <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Nömrə</TableHead><TableHead>Müştəri</TableHead><TableHead className="text-right">Yekun</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {(orders ?? []).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                    <TableCell>{o.customerName}</TableCell>
                    <TableCell className="text-right tnum">{formatCurrency(o.grandTotal, o.currency)}</TableCell>
                    <TableCell><Badge variant={o.status === 'invoiced' ? 'success' : 'default'}>{o.status}</Badge></TableCell>
                    <TableCell className="text-right">{canCreate && o.status !== 'invoiced' && <Button variant="outline" size="sm" disabled={busyId === o.id} onClick={() => toInvoice(o)}>{busyId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Fakturaya</Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}
      </div>

      {canCreate && <NewQuoteDialog open={open} onOpenChange={setOpen} companyId={companyId} actorUid={actorUid} baseCurrency={baseCurrency}
        customers={customers ?? []} onSaved={invalidate} />}
    </div>
  );
}

function NewQuoteDialog({ open, onOpenChange, companyId, actorUid, baseCurrency, customers, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; baseCurrency: string;
  customers: { id: string; name: string }[]; onSaved: () => void;
}) {
  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  async function save() {
    const c = customers.find((x) => x.id === customerId);
    if (!c) { toast.error('Müştəri seçin'); return; }
    const valid = lines.filter((l) => l.description && l.unitPrice > 0);
    if (valid.length === 0) { toast.error('Ən azı 1 sətir'); return; }
    setSaving(true);
    try {
      await createQuote({ companyId, customerId, customerName: c.name, issueDate, currency: baseCurrency, lineItems: valid, createdBy: actorUid });
      toast.success('Təklif yaradıldı');
      setCustomerId(''); setLines([emptyLine()]);
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Yeni kommersiya təklifi</DialogTitle></DialogHeader>
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
