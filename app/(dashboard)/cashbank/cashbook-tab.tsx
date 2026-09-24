'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { listCashTransactions, listCashRegisters, createCashTransaction } from '@/lib/firebase/treasury';
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
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { CashTxnCategory } from '@/types';

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

const CATEGORIES: { value: CashTxnCategory; label: string; en: string }[] = [
  { value: 'sales_receipt', label: 'Satış mədaxili', en: 'Sales receipt' }, { value: 'expense', label: 'Xərc', en: 'Expense' },
  { value: 'owner_contribution', label: 'Sahibkar qoyuluşu', en: 'Owner contribution' }, { value: 'bank_deposit', label: 'Banka köçürmə', en: 'Bank deposit' },
  { value: 'bank_withdrawal', label: 'Bankdan çıxarış', en: 'Bank withdrawal' }, { value: 'other', label: 'Digər', en: 'Other' },
];

export function CashbookTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const tt = useTT();
  const catLabel = (v: string) => { const c = CATEGORIES.find((x) => x.value === v); return c ? tt(c.label, c.en) : v; };
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['cashtxns', companyId], queryFn: () => listCashTransactions(companyId) });
  const { data: registers } = useQuery({ queryKey: ['cash', companyId], queryFn: () => listCashRegisters(companyId) });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <ExportButton filename="kassa-emeliyyatlari" rows={data ?? []}
          columns={[
            { header: tt('Tarix', 'Date'), value: 'transactionDate' }, { header: tt('Növ', 'Type'), value: (t) => t.type === 'cash_in' ? tt('Mədaxil', 'Cash in') : tt('Məxaric', 'Cash out') },
            { header: tt('Kateqoriya', 'Category'), value: (t) => catLabel(t.category) }, { header: tt('Məbləğ', 'Amount'), value: 'amount' }, { header: tt('Qeyd', 'Note'), value: (t) => t.note ?? '' },
          ]} />
        {canCreate && <Button size="sm" onClick={() => setOpen(true)} disabled={!registers || registers.length === 0}><Plus className="h-4 w-4" /> {tt('Kassa əməliyyatı', 'Cash transaction')}</Button>}
      </div>
      {(!registers || registers.length === 0) && <p className="mb-3 text-xs text-warning-foreground">{tt('Əvvəlcə «Hesablar və xəzinə» bölməsindən kassa əlavə edin.', 'First add a cash register from the “Accounts & treasury” tab.')}</p>}
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Kassa əməliyyatı yoxdur', 'No cash transactions')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{tt('Tarix', 'Date')}</TableHead><TableHead>{tt('Növ', 'Type')}</TableHead><TableHead>{tt('Kateqoriya', 'Category')}</TableHead><TableHead className="text-right">{tt('Məbləğ', 'Amount')}</TableHead><TableHead>{tt('Qeyd', 'Note')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground">{formatDate(new Date(t.transactionDate).getTime())}</TableCell>
                  <TableCell><Badge variant={t.type === 'cash_in' ? 'success' : 'secondary'}>{t.type === 'cash_in' ? tt('mədaxil', 'cash in') : tt('məxaric', 'cash out')}</Badge></TableCell>
                  <TableCell>{catLabel(t.category)}</TableCell>
                  <TableCell className={`text-right tnum ${t.type === 'cash_in' ? 'text-success' : 'text-danger'}`}>{t.type === 'cash_in' ? '+' : '−'}{formatCurrency(t.amount, t.currency)}</TableCell>
                  <TableCell className="text-muted-foreground">{t.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {canCreate && <CashDialog open={open} onOpenChange={setOpen} companyId={companyId} actorUid={actorUid} baseCurrency={baseCurrency}
        registers={registers ?? []} onSaved={() => { qc.invalidateQueries({ queryKey: ['cashtxns', companyId] }); qc.invalidateQueries({ queryKey: ['cash', companyId] }); qc.invalidateQueries({ queryKey: ['journal', companyId] }); }} />}
    </div>
  );
}

function CashDialog({ open, onOpenChange, companyId, actorUid, baseCurrency, registers, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; baseCurrency: string; registers: { id: string; name: string; currency: string }[]; onSaved: () => void;
}) {
  const tt = useTT();
  const [registerId, setRegisterId] = useState('');
  const [type, setType] = useState<'cash_in' | 'cash_out'>('cash_in');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<CashTxnCategory>('sales_receipt');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    const reg = registers.find((r) => r.id === registerId);
    const amt = Number(amount) || 0;
    if (!reg || amt <= 0) { toast.error(tt('Kassa və məbləğ tələb olunur', 'Register and amount are required')); return; }
    setSaving(true);
    try {
      await createCashTransaction({ companyId, cashRegisterId: registerId, type, amount: amt, currency: reg.currency, category, transactionDate: date, note, baseCurrency, performedBy: actorUid });
      toast.success(tt('Əməliyyat qeyd edildi', 'Transaction recorded'), tt('Kassa balansı və jurnal yeniləndi', 'Cash balance and journal updated'));
      setRegisterId(''); setAmount(''); setNote('');
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tt('Kassa əməliyyatı', 'Cash transaction')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Kassa', 'Register')}</Label>
              <Select value={registerId} onValueChange={setRegisterId}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
                <SelectContent>{registers.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>{tt('Növ', 'Type')}</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'cash_in' | 'cash_out')}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cash_in">{tt('Mədaxil', 'Cash in')}</SelectItem><SelectItem value="cash_out">{tt('Məxaric', 'Cash out')}</SelectItem></SelectContent></Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Məbləğ', 'Amount')}</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Tarix', 'Date')}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>{tt('Kateqoriya', 'Category')}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as CashTxnCategory)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{tt(c.label, c.en)}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>{tt('Qeyd', 'Note')}</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Qeyd et', 'Record')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
