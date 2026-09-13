'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import {
  listPayments, listBankAccounts, listCashRegisters, recordPayment,
  openInvoicesForCustomer, openBillsForVendor, listVendors,
} from '@/lib/firebase/treasury';
import { listCustomers } from '@/lib/firebase/sales';
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
import type { PaymentAllocation } from '@/types';

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function PaymentsTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['payments', companyId], queryFn: () => listPayments(companyId) });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <ExportButton filename="odenisler" rows={data ?? []}
          columns={[
            { header: 'İstiqamət', value: (p) => p.direction === 'incoming' ? 'Daxil olan' : 'Çıxan' },
            { header: 'Tərəf', value: (p) => p.counterpartyRef?.name ?? '' },
            { header: 'Tarix', value: 'paymentDate' }, { header: 'Məbləğ', value: 'amount' },
            { header: 'Metod', value: 'method' }, { header: 'Status', value: 'status' },
          ]} />
        {canCreate && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Ödəniş qeyd et</Button>}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Ödəniş yoxdur" />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead></TableHead><TableHead>Tərəf</TableHead><TableHead>Tarix</TableHead><TableHead className="text-right">Məbləğ</TableHead><TableHead>Metod</TableHead><TableHead>Tətbiq</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.direction === 'incoming' ? <ArrowDownLeft className="h-4 w-4 text-success" /> : <ArrowUpRight className="h-4 w-4 text-danger" />}</TableCell>
                  <TableCell className="font-medium">{p.counterpartyRef?.name}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(new Date(p.paymentDate).getTime())}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(p.amount, p.currency)}</TableCell>
                  <TableCell><Badge variant="secondary">{p.method}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.allocations?.length ?? 0} faktura{p.unallocatedAmount > 0 ? ` · avans ${formatCurrency(p.unallocatedAmount, p.currency)}` : ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {canCreate && <RecordPaymentDialog open={open} onOpenChange={setOpen} companyId={companyId} actorUid={actorUid} baseCurrency={baseCurrency}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['payments', companyId] });
          qc.invalidateQueries({ queryKey: ['invoices', companyId] });
          qc.invalidateQueries({ queryKey: ['purchaseBills', companyId] });
          qc.invalidateQueries({ queryKey: ['banks', companyId] });
          qc.invalidateQueries({ queryKey: ['cash', companyId] });
          qc.invalidateQueries({ queryKey: ['journal', companyId] });
          qc.invalidateQueries({ queryKey: ['aging', companyId] });
        }} />}
    </div>
  );
}

function RecordPaymentDialog({ open, onOpenChange, companyId, actorUid, baseCurrency, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; baseCurrency: string; onSaved: () => void;
}) {
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>('incoming');
  const [counterpartyId, setCounterpartyId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [alloc, setAlloc] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: customers } = useQuery({ queryKey: ['customers', companyId], queryFn: () => listCustomers(companyId), enabled: open && direction === 'incoming' });
  const { data: vendors } = useQuery({ queryKey: ['vendors', companyId], queryFn: () => listVendors(companyId), enabled: open && direction === 'outgoing' });
  const { data: banks } = useQuery({ queryKey: ['banks', companyId], queryFn: () => listBankAccounts(companyId), enabled: open });
  const { data: cash } = useQuery({ queryKey: ['cash', companyId], queryFn: () => listCashRegisters(companyId), enabled: open });

  const { data: openInv } = useQuery({
    queryKey: ['open-inv', companyId, counterpartyId],
    queryFn: () => openInvoicesForCustomer(companyId, counterpartyId),
    enabled: open && direction === 'incoming' && !!counterpartyId,
  });
  const { data: openBills } = useQuery({
    queryKey: ['open-bills', companyId, counterpartyId],
    queryFn: () => openBillsForVendor(companyId, counterpartyId),
    enabled: open && direction === 'outgoing' && !!counterpartyId,
  });

  // Ödəniş məbləğini açıq fakturalara köhnədən-yeniyə avtomatik payla
  useEffect(() => {
    const amt = Number(amount) || 0;
    const docs = direction === 'incoming' ? (openInv ?? []) : (openBills ?? []);
    let remaining = amt;
    const next: Record<string, string> = {};
    for (const d of docs) {
      if (remaining <= 0) break;
      const due = d.amountDue ?? 0;
      const take = Math.min(due, remaining);
      next[d.id] = take.toFixed(2);
      remaining = Math.round((remaining - take) * 100) / 100;
    }
    setAlloc(next);
  }, [amount, openInv, openBills, direction]);

  const sources = [
    ...(banks ?? []).map((b) => ({ id: b.id, type: 'bank' as const, label: `🏦 ${b.accountName} (${b.currency})` })),
    ...(cash ?? []).map((c) => ({ id: c.id, type: 'cash' as const, label: `💵 ${c.name} (${c.currency})` })),
  ];
  const counterparties = direction === 'incoming' ? (customers ?? []) : (vendors ?? []);
  const docs = direction === 'incoming' ? (openInv ?? []) : (openBills ?? []);

  async function save() {
    const src = sources.find((s) => s.id === sourceId);
    const cp = counterparties.find((c) => c.id === counterpartyId);
    const amt = Number(amount) || 0;
    if (!src || !cp || amt <= 0) { toast.error('Tərəf, hesab və məbləğ tələb olunur'); return; }
    const allocations: PaymentAllocation[] = docs
      .filter((d) => Number(alloc[d.id]) > 0)
      .map((d) => ({
        invoiceType: direction === 'incoming' ? 'salesInvoice' : 'purchaseBill',
        invoiceId: d.id, invoiceNumber: 'invoiceNumber' in d ? d.invoiceNumber : ('billNumber' in d ? (d as { billNumber: string }).billNumber : ''),
        allocatedAmount: Number(alloc[d.id]),
      }));
    setSaving(true);
    try {
      await recordPayment({
        companyId, direction, method: src.type === 'cash' ? 'cash' : 'bank_transfer',
        source: { type: src.type, id: src.id }, counterparty: { type: direction === 'incoming' ? 'customer' : 'vendor', id: cp.id, name: cp.name },
        amount: amt, currency: baseCurrency, paymentDate, allocations, baseCurrency, createdBy: actorUid,
      });
      toast.success('Ödəniş qeyd edildi', 'Faktura(lar) və balans yeniləndi, jurnal yazıldı');
      setCounterpartyId(''); setSourceId(''); setAmount(''); setAlloc({});
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Ödəniş qeyd et</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>İstiqamət</Label>
              <Select value={direction} onValueChange={(v) => { setDirection(v as 'incoming' | 'outgoing'); setCounterpartyId(''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="incoming">Daxil olan (müştəridən)</SelectItem><SelectItem value="outgoing">Çıxan (kreditora)</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Tarix</Label><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{direction === 'incoming' ? 'Müştəri' : 'Kreditor'}</Label>
              <Select value={counterpartyId} onValueChange={setCounterpartyId}>
                <SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                <SelectContent>{counterparties.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Hesab / Kassa</Label>
              <Select value={sourceId} onValueChange={setSourceId}>
                <SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                <SelectContent>{sources.map((s) => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Məbləğ ({baseCurrency})</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>

          {counterpartyId && (
            <div className="rounded-card border border-border p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Açıq {direction === 'incoming' ? 'fakturalar' : 'kreditor fakturalar'} (köhnədən paylanır)</p>
              {docs.length === 0 ? <p className="py-2 text-sm text-muted-foreground">Açıq sənəd yoxdur — məbləğ avans kimi qalacaq</p> : docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2 border-b border-border/40 py-1.5 text-sm last:border-0">
                  <span className="font-mono text-xs">{'invoiceNumber' in d ? d.invoiceNumber : (d as { billNumber: string }).billNumber}</span>
                  <span className="text-muted-foreground">qalıq {formatCurrency(d.amountDue ?? 0, baseCurrency)}</span>
                  <Input className="w-28" type="number" value={alloc[d.id] ?? ''} onChange={(e) => setAlloc((a) => ({ ...a, [d.id]: e.target.value }))} />
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Qeyd et</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
