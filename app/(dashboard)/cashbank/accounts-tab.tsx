'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Landmark, Wallet } from 'lucide-react';
import {
  listBankAccounts, listCashRegisters, createBankAccount, createCashRegister,
} from '@/lib/firebase/treasury';
import { ExportButton } from '@/components/shared/export-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency } from '@/lib/utils/format';

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function AccountsTab({ companyId, canCreate, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const tt = useTT();
  const [mode, setMode] = useState<'bank' | 'cash' | null>(null);
  const { data: banks, isLoading: lb } = useQuery({ queryKey: ['banks', companyId], queryFn: () => listBankAccounts(companyId) });
  const { data: cash, isLoading: lc } = useQuery({ queryKey: ['cash', companyId], queryFn: () => listCashRegisters(companyId) });

  const totalByCurrency = new Map<string, number>();
  for (const b of banks ?? []) totalByCurrency.set(b.currency, (totalByCurrency.get(b.currency) ?? 0) + (b.currentBalance ?? 0));
  for (const c of cash ?? []) totalByCurrency.set(c.currency, (totalByCurrency.get(c.currency) ?? 0) + (c.currentBalance ?? 0));

  return (
    <div className="space-y-6">
      {/* Xəzinədarlıq xülasəsi */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...totalByCurrency.entries()].map(([cur, total]) => (
          <Card key={cur} className="rounded-card"><CardContent className="flex items-center gap-3 p-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Landmark className="h-5 w-5" /></span>
            <div><p className="text-xl font-bold tnum">{formatCurrency(total, cur)}</p><p className="text-xs text-muted-foreground">{tt('Ümumi qalıq', 'Total balance')} ({cur})</p></div>
          </CardContent></Card>
        ))}
        {totalByCurrency.size === 0 && <p className="text-sm text-muted-foreground">{tt('Hesab əlavə edin.', 'Add an account.')}</p>}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold"><Landmark className="h-4 w-4 text-primary" /> {tt('Bank hesabları', 'Bank accounts')}</h3>
          <div className="flex items-center gap-2">
            <ExportButton filename="bank-hesablari" rows={banks ?? []} columns={[
              { header: tt('Hesab adı', 'Account name'), value: 'accountName' }, { header: 'Bank', value: 'bankName' },
              { header: 'IBAN', value: 'iban' }, { header: tt('Valyuta', 'Currency'), value: 'currency' },
              { header: tt('Qalıq', 'Balance'), value: (b) => b.currentBalance ?? 0 },
            ]} />
            {canCreate && <Button size="sm" variant="outline" onClick={() => setMode('bank')}><Plus className="h-4 w-4" /> {tt('Bank hesabı', 'Bank account')}</Button>}
          </div>
        </div>
        {lb ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(banks ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{tt('Bank hesabı yoxdur', 'No bank accounts')}</p> : (banks ?? []).map((b) => (
              <Card key={b.id} className="rounded-card"><CardContent className="p-4">
                <div className="flex items-center justify-between"><p className="font-semibold">{b.accountName}</p><Badge variant={b.isActive ? 'success' : 'secondary'}>{b.currency}</Badge></div>
                <p className="text-xs text-muted-foreground">{b.bankName} · {b.iban}</p>
                <p className="mt-2 text-lg font-bold tnum">{formatCurrency(b.currentBalance ?? 0, b.currency)}</p>
              </CardContent></Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4 text-primary" /> {tt('Kassalar', 'Cash registers')}</h3>
          <div className="flex items-center gap-2">
            <ExportButton filename="kassalar" rows={cash ?? []} columns={[
              { header: tt('Ad', 'Name'), value: 'name' }, { header: tt('Valyuta', 'Currency'), value: 'currency' },
              { header: tt('Qalıq', 'Balance'), value: (c) => c.currentBalance ?? 0 },
            ]} />
            {canCreate && <Button size="sm" variant="outline" onClick={() => setMode('cash')}><Plus className="h-4 w-4" /> {tt('Kassa', 'Cash register')}</Button>}
          </div>
        </div>
        {lc ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(cash ?? []).length === 0 ? <p className="text-sm text-muted-foreground">{tt('Kassa yoxdur', 'No cash registers')}</p> : (cash ?? []).map((c) => (
              <Card key={c.id} className="rounded-card"><CardContent className="p-4">
                <div className="flex items-center justify-between"><p className="font-semibold">{c.name}</p><Badge variant="secondary">{c.currency}</Badge></div>
                <p className="mt-2 text-lg font-bold tnum">{formatCurrency(c.currentBalance ?? 0, c.currency)}</p>
              </CardContent></Card>
            ))}
          </div>
        )}
      </div>

      <AccountDialog mode={mode} onClose={() => setMode(null)} companyId={companyId} baseCurrency={baseCurrency}
        onSaved={() => { qc.invalidateQueries({ queryKey: ['banks', companyId] }); qc.invalidateQueries({ queryKey: ['cash', companyId] }); }} />
    </div>
  );
}

function AccountDialog({ mode, onClose, companyId, baseCurrency, onSaved }: {
  mode: 'bank' | 'cash' | null; onClose: () => void; companyId: string; baseCurrency: string; onSaved: () => void;
}) {
  const tt = useTT();
  const [name, setName] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) { toast.error(tt('Ad tələb olunur', 'Name is required')); return; }
    setSaving(true);
    try {
      if (mode === 'bank') await createBankAccount({ companyId, bankName: bankName.trim(), accountName: name.trim(), iban: iban.trim(), swiftCode: null, currency, currentBalance: 0, isActive: true });
      else await createCashRegister({ companyId, name: name.trim(), departmentId: null, currency, currentBalance: 0, isActive: true });
      toast.success(tt('Əlavə edildi', 'Added'));
      setName(''); setBankName(''); setIban('');
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={!!mode} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{mode === 'bank' ? tt('Yeni bank hesabı', 'New bank account') : tt('Yeni kassa', 'New cash register')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>{mode === 'bank' ? tt('Hesab adı', 'Account name') : tt('Kassa adı', 'Register name')}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          {mode === 'bank' && <>
            <div className="space-y-2"><Label>Bank</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Kapital Bank" /></div>
            <div className="space-y-2"><Label>IBAN</Label><Input value={iban} onChange={(e) => setIban(e.target.value)} /></div>
          </>}
          <div className="space-y-2"><Label>{tt('Valyuta', 'Currency')}</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['AZN', 'USD', 'EUR', 'TRY', 'RUB'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Əlavə et', 'Add')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
