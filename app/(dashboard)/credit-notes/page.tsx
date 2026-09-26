'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Undo2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listCreditNotes, createCreditNote } from '@/lib/firebase/credit-notes';
import { listInvoices } from '@/lib/firebase/sales';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils/format';
import type { CreditNote } from '@/types';

export default function CreditNotesPage() {
  const tt = useTT();
  const qc = useQueryClient();
  const { active, isSuperAdmin, can, profile } = useAuth();
  const companyId = active?.companyId;
  const cur = active?.company.baseCurrency ?? 'AZN';
  const canView = isSuperAdmin || can('sales.invoice.view');
  const canEdit = isSuperAdmin || can('sales.invoice.create');
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['creditNotes', companyId], queryFn: () => listCreditNotes(companyId!), enabled: canView && !!companyId });

  if (!companyId) return <div><PageHeader title={tt('Kredit-notlar', 'Credit notes')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('Kredit-notlar', 'Credit notes')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader
        title={tt('Kredit-notlar (satış qaytarması)', 'Credit notes (sales returns)')}
        subtitle={tt('Fakturanı tam geri qaytarır — mühasibatda əks-yazı yaranır', 'Fully reverses an invoice — a reversing journal entry is posted')}
        action={canEdit && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni kredit-not', 'New credit note')}</Button>}
      />

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : !data || data.length === 0 ? <EmptyState title={tt('Kredit-not yoxdur', 'No credit notes')} action={canEdit && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni kredit-not', 'New credit note')}</Button>} />
        : (
          <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>№</TableHead><TableHead>{tt('Faktura', 'Invoice')}</TableHead><TableHead>{tt('Müştəri', 'Customer')}</TableHead>
                <TableHead>{tt('Tarix', 'Date')}</TableHead><TableHead className="text-right">{tt('Məbləğ', 'Amount')}</TableHead><TableHead>{tt('Səbəb', 'Reason')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.map((cn) => (
                  <TableRow key={cn.id}>
                    <TableCell className="font-medium">{cn.creditNoteNumber}</TableCell>
                    <TableCell>{cn.invoiceNumber}</TableCell>
                    <TableCell>{cn.customerName ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{cn.issueDate}</TableCell>
                    <TableCell className="text-right tnum font-semibold text-rose-600">−{formatCurrency(cn.grandTotal, cur)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">{cn.reason ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div></CardContent></Card>
        )}

      {open && <CreateDialog companyId={companyId} cur={cur} baseCurrency={cur} actorUid={profile?.uid ?? ''} existing={data ?? []} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ['creditNotes', companyId] }); qc.invalidateQueries({ queryKey: ['invoices', companyId] }); }} />}
    </div>
  );
}

function CreateDialog({ companyId, cur, baseCurrency, actorUid, existing, onClose, onSaved }: { companyId: string; cur: string; baseCurrency: string; actorUid: string; existing: CreditNote[]; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const { data: invoices } = useQuery({ queryKey: ['invoices', companyId], queryFn: () => listInvoices(companyId) });
  const creditedByInvoice = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of existing) m.set(c.invoiceId, round2((m.get(c.invoiceId) ?? 0) + (c.grandTotal || 0)));
    return m;
  }, [existing]);
  const creditable = useMemo(() => (invoices ?? []).filter((i) =>
    ['sent', 'partially_paid', 'overdue'].includes(i.status) && round2(i.grandTotal - (creditedByInvoice.get(i.id) ?? 0)) > 0.0001
  ), [invoices, creditedByInvoice]);
  const [invoiceId, setInvoiceId] = useState('');
  const [reason, setReason] = useState('');
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const inv = creditable.find((i) => i.id === invoiceId);
  const remaining = inv ? round2(inv.grandTotal - (creditedByInvoice.get(inv.id) ?? 0)) : 0;

  async function save() {
    if (!inv) { toast.error(tt('Faktura seçin', 'Select an invoice')); return; }
    const amt = partial ? Number(amount) : null;
    if (partial && (!(amt! > 0) || amt! > remaining + 0.0001)) { toast.error(tt('Məbləğ 0 ilə qalıq arasında olmalıdır', 'Amount must be between 0 and the remaining')); return; }
    setSaving(true);
    try {
      await createCreditNote({ invoice: inv, amount: amt, reason: reason.trim() || null, baseCurrency, actorUid });
      toast.success(tt('Kredit-not yaradıldı', 'Credit note created'), partial ? tt('Qismən qaytarma mühasibata düşdü', 'Partial reversal posted') : tt('Əks-yazı mühasibata düşdü, faktura bağlandı', 'Reversing entry posted, invoice closed'));
      onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{tt('Yeni kredit-not', 'New credit note')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>{tt('Faktura', 'Invoice')}</Label>
            <Select value={invoiceId} onValueChange={(v) => { setInvoiceId(v); const i = creditable.find((x) => x.id === v); setAmount(i ? String(round2(i.grandTotal - (creditedByInvoice.get(i.id) ?? 0))) : ''); }}>
              <SelectTrigger><SelectValue placeholder={tt('Rəsmiləşmiş faktura seçin', 'Select a posted invoice')} /></SelectTrigger>
              <SelectContent>{creditable.map((i) => <SelectItem key={i.id} value={i.id}>{i.invoiceNumber} · {i.customerName} · {formatCurrency(i.grandTotal, i.currency || cur)}</SelectItem>)}</SelectContent>
            </Select>
            {creditable.length === 0 && <p className="text-xs text-muted-foreground">{tt('Qaytarıla bilən (rəsmiləşmiş) faktura yoxdur.', 'No creditable (posted) invoices.')}</p>}
          </div>
          {inv && (
            <div className="rounded-lg bg-secondary/40 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{tt('Qaytarıla bilən qalıq', 'Remaining creditable')}</span><span className="font-bold text-rose-600">{formatCurrency(remaining, cur)}</span></div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} /> {tt('Qismən qaytarma', 'Partial return')}</label>
          {partial && <div className="space-y-1"><Label>{tt('Qaytarılacaq məbləğ', 'Amount to return')}</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} max={remaining} /></div>}
          <div className="space-y-1"><Label>{tt('Səbəb', 'Reason')}</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tt('Qaytarma səbəbi', 'Return reason')} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button>
          <Button onClick={save} disabled={saving || !inv}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} {tt('Kredit-not yarat', 'Create credit note')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
