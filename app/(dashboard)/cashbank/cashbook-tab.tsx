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
import { formatCurrency, formatDate } from '@/lib/utils/format';
import type { CashTxnCategory } from '@/types';

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

const CATEGORIES: { value: CashTxnCategory; label: string }[] = [
  { value: 'sales_receipt', label: 'Satış mədaxili' }, { value: 'expense', label: 'Xərc' },
  { value: 'owner_contribution', label: 'Sahibkar qoyuluşu' }, { value: 'bank_deposit', label: 'Banka köçürmə' },
  { value: 'bank_withdrawal', label: 'Bankdan çıxarış' }, { value: 'other', label: 'Digər' },
];

export function CashbookTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['cashtxns', companyId], queryFn: () => listCashTransactions(companyId) });
  const { data: registers } = useQuery({ queryKey: ['cash', companyId], queryFn: () => listCashRegisters(companyId) });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <ExportButton filename="kassa-emeliyyatlari" rows={data ?? []}
          columns={[
            { header: 'Tarix', value: 'transactionDate' }, { header: 'Növ', value: (t) => t.type === 'cash_in' ? 'Mədaxil' : 'Məxaric' },
            { header: 'Kateqoriya', value: 'category' }, { header: 'Məbləğ', value: 'amount' }, { header: 'Qeyd', value: (t) => t.note ?? '' },
          ]} />
        {canCreate && <Button size="sm" onClick={() => setOpen(true)} disabled={!registers || registers.length === 0}><Plus className="h-4 w-4" /> Kassa əməliyyatı</Button>}
      </div>
      {(!registers || registers.length === 0) && <p className="mb-3 text-xs text-warning-foreground">Əvvəlcə «Hesablar və xəzinə» bölməsindən kassa əlavə edin.</p>}
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Kassa əməliyyatı yoxdur" />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Tarix</TableHead><TableHead>Növ</TableHead><TableHead>Kateqoriya</TableHead><TableHead className="text-right">Məbləğ</TableHead><TableHead>Qeyd</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground">{formatDate(new Date(t.transactionDate).getTime())}</TableCell>
                  <TableCell><Badge variant={t.type === 'cash_in' ? 'success' : 'secondary'}>{t.type === 'cash_in' ? 'mədaxil' : 'məxaric'}</Badge></TableCell>
                  <TableCell>{CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category}</TableCell>
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
    if (!reg || amt <= 0) { toast.error('Kassa və məbləğ tələb olunur'); return; }
    setSaving(true);
    try {
      await createCashTransaction({ companyId, cashRegisterId: registerId, type, amount: amt, currency: reg.currency, category, transactionDate: date, note, baseCurrency, performedBy: actorUid });
      toast.success('Əməliyyat qeyd edildi', 'Kassa balansı və jurnal yeniləndi');
      setRegisterId(''); setAmount(''); setNote('');
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Kassa əməliyyatı</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Kassa</Label>
              <Select value={registerId} onValueChange={setRegisterId}><SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                <SelectContent>{registers.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Növ</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'cash_in' | 'cash_out')}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cash_in">Mədaxil</SelectItem><SelectItem value="cash_out">Məxaric</SelectItem></SelectContent></Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Məbləğ</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="space-y-2"><Label>Tarix</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Kateqoriya</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as CashTxnCategory)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>Qeyd</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Qeyd et</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
