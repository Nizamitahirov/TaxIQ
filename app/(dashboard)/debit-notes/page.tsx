'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Undo2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listDebitNotes, createDebitNote } from '@/lib/firebase/debit-notes';
import { listPurchaseBills } from '@/lib/firebase/treasury';
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
import type { DebitNote } from '@/types';

export default function DebitNotesPage() {
  const tt = useTT();
  const qc = useQueryClient();
  const { active, isSuperAdmin, can, profile } = useAuth();
  const companyId = active?.companyId;
  const cur = active?.company.baseCurrency ?? 'AZN';
  const canView = isSuperAdmin || can('cashbank.transaction.view') || can('accounting.journal.view');
  const canEdit = isSuperAdmin || can('cashbank.transaction.create') || can('accounting.journal.create');
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['debitNotes', companyId], queryFn: () => listDebitNotes(companyId!), enabled: canView && !!companyId });

  if (!companyId) return <div><PageHeader title={tt('Debit-notlar', 'Debit notes')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('Debit-notlar', 'Debit notes')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader
        title={tt('Debit-notlar (alış qaytarması)', 'Debit notes (purchase returns)')}
        subtitle={tt('Kreditor fakturanı tam geri qaytarır — mühasibatda əks-yazı yaranır', 'Fully reverses a purchase bill — a reversing journal entry is posted')}
        action={canEdit && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni debit-not', 'New debit note')}</Button>}
      />

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : !data || data.length === 0 ? <EmptyState title={tt('Debit-not yoxdur', 'No debit notes')} action={canEdit && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni debit-not', 'New debit note')}</Button>} />
        : (
          <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>№</TableHead><TableHead>{tt('Kreditor faktura', 'Bill')}</TableHead><TableHead>{tt('Təchizatçı', 'Vendor')}</TableHead>
                <TableHead>{tt('Tarix', 'Date')}</TableHead><TableHead className="text-right">{tt('Məbləğ', 'Amount')}</TableHead><TableHead>{tt('Səbəb', 'Reason')}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {data.map((dn) => (
                  <TableRow key={dn.id}>
                    <TableCell className="font-medium">{dn.debitNoteNumber}</TableCell>
                    <TableCell>{dn.billNumber}</TableCell>
                    <TableCell>{dn.vendorName ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{dn.issueDate}</TableCell>
                    <TableCell className="text-right tnum font-semibold text-rose-600">−{formatCurrency(dn.grandTotal, cur)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">{dn.reason ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div></CardContent></Card>
        )}

      {open && <CreateDialog companyId={companyId} cur={cur} baseCurrency={cur} actorUid={profile?.uid ?? ''} existing={data ?? []} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ['debitNotes', companyId] }); qc.invalidateQueries({ queryKey: ['purchaseBills', companyId] }); }} />}
    </div>
  );
}

function CreateDialog({ companyId, cur, baseCurrency, actorUid, existing, onClose, onSaved }: { companyId: string; cur: string; baseCurrency: string; actorUid: string; existing: DebitNote[]; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const { data: bills } = useQuery({ queryKey: ['purchaseBills', companyId], queryFn: () => listPurchaseBills(companyId) });
  const debitedByBill = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of existing) m.set(d.billId, round2((m.get(d.billId) ?? 0) + (d.grandTotal || 0)));
    return m;
  }, [existing]);
  const debitable = useMemo(() => (bills ?? []).filter((b) =>
    ['approved', 'partially_paid', 'overdue'].includes(b.status) && round2(b.grandTotal - (debitedByBill.get(b.id) ?? 0)) > 0.0001
  ), [bills, debitedByBill]);
  const [billId, setBillId] = useState('');
  const [reason, setReason] = useState('');
  const [partial, setPartial] = useState(false);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const bill = debitable.find((b) => b.id === billId);
  const remaining = bill ? round2(bill.grandTotal - (debitedByBill.get(bill.id) ?? 0)) : 0;

  async function save() {
    if (!bill) { toast.error(tt('Kreditor faktura seçin', 'Select a bill')); return; }
    const amt = partial ? Number(amount) : null;
    if (partial && (!(amt! > 0) || amt! > remaining + 0.0001)) { toast.error(tt('Məbləğ 0 ilə qalıq arasında olmalıdır', 'Amount must be between 0 and the remaining')); return; }
    setSaving(true);
    try {
      await createDebitNote({ bill, amount: amt, reason: reason.trim() || null, baseCurrency, actorUid });
      toast.success(tt('Debit-not yaradıldı', 'Debit note created'), partial ? tt('Qismən qaytarma mühasibata düşdü', 'Partial reversal posted') : tt('Əks-yazı mühasibata düşdü, faktura bağlandı', 'Reversing entry posted, bill closed'));
      onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{tt('Yeni debit-not', 'New debit note')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>{tt('Kreditor faktura', 'Purchase bill')}</Label>
            <Select value={billId} onValueChange={(v) => { setBillId(v); const b = debitable.find((x) => x.id === v); setAmount(b ? String(round2(b.grandTotal - (debitedByBill.get(b.id) ?? 0))) : ''); }}>
              <SelectTrigger><SelectValue placeholder={tt('Təsdiqlənmiş faktura seçin', 'Select an approved bill')} /></SelectTrigger>
              <SelectContent>{debitable.map((b) => <SelectItem key={b.id} value={b.id}>{b.billNumber} · {b.vendorName} · {formatCurrency(b.grandTotal, b.currency || cur)}</SelectItem>)}</SelectContent>
            </Select>
            {debitable.length === 0 && <p className="text-xs text-muted-foreground">{tt('Qaytarıla bilən (təsdiqlənmiş) faktura yoxdur.', 'No debitable (approved) bills.')}</p>}
          </div>
          {bill && (
            <div className="rounded-lg bg-secondary/40 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{tt('Qaytarıla bilən qalıq', 'Remaining')}</span><span className="font-bold text-rose-600">{formatCurrency(remaining, cur)}</span></div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={partial} onChange={(e) => setPartial(e.target.checked)} /> {tt('Qismən qaytarma', 'Partial return')}</label>
          {partial && <div className="space-y-1"><Label>{tt('Qaytarılacaq məbləğ', 'Amount to return')}</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} max={remaining} /></div>}
          <div className="space-y-1"><Label>{tt('Səbəb', 'Reason')}</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tt('Qaytarma səbəbi', 'Return reason')} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button>
          <Button onClick={save} disabled={saving || !bill}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />} {tt('Debit-not yarat', 'Create debit note')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
