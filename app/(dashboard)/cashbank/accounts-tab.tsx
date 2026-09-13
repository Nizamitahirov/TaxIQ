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
import { formatCurrency } from '@/lib/utils/format';

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function AccountsTab({ companyId, canCreate, baseCurrency }: TabProps) {
  const qc = useQueryClient();
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
            <div><p className="text-xl font-bold tnum">{formatCurrency(total, cur)}</p><p className="text-xs text-muted-foreground">Ümumi qalıq ({cur})</p></div>
          </CardContent></Card>
        ))}
        {totalByCurrency.size === 0 && <p className="text-sm text-muted-foreground">Hesab əlavə edin.</p>}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 font-semibold"><Landmark className="h-4 w-4 text-primary" /> Bank hesabları</h3>
          <div className="flex items-center gap-2">
            <ExportButton filename="bank-hesablari" rows={banks ?? []} columns={[
              { header: 'Hesab adı', value: 'accountName' }, { header: 'Bank', value: 'bankName' },
              { header: 'IBAN', value: 'iban' }, { header: 'Valyuta', value: 'currency' },
              { header: 'Qalıq', value: (b) => b.currentBalance ?? 0 },
            ]} />
            {canCreate && <Button size="sm" variant="outline" onClick={() => setMode('bank')}><Plus className="h-4 w-4" /> Bank hesabı</Button>}
          </div>
        </div>
        {lb ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(banks ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Bank hesabı yoxdur</p> : (banks ?? []).map((b) => (
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
          <h3 className="flex items-center gap-2 font-semibold"><Wallet className="h-4 w-4 text-primary" /> Kassalar</h3>
          <div className="flex items-center gap-2">
            <ExportButton filename="kassalar" rows={cash ?? []} columns={[
              { header: 'Ad', value: 'name' }, { header: 'Valyuta', value: 'currency' },
              { header: 'Qalıq', value: (c) => c.currentBalance ?? 0 },
            ]} />
            {canCreate && <Button size="sm" variant="outline" onClick={() => setMode('cash')}><Plus className="h-4 w-4" /> Kassa</Button>}
          </div>
        </div>
        {lc ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(cash ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Kassa yoxdur</p> : (cash ?? []).map((c) => (
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
  const [name, setName] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) { toast.error('Ad tələb olunur'); return; }
    setSaving(true);
    try {
      if (mode === 'bank') await createBankAccount({ companyId, bankName: bankName.trim(), accountName: name.trim(), iban: iban.trim(), swiftCode: null, currency, currentBalance: 0, isActive: true });
      else await createCashRegister({ companyId, name: name.trim(), departmentId: null, currency, currentBalance: 0, isActive: true });
      toast.success('Əlavə edildi');
      setName(''); setBankName(''); setIban('');
      onSaved(); onClose();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={!!mode} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{mode === 'bank' ? 'Yeni bank hesabı' : 'Yeni kassa'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>{mode === 'bank' ? 'Hesab adı' : 'Kassa adı'}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          {mode === 'bank' && <>
            <div className="space-y-2"><Label>Bank</Label><Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Kapital Bank" /></div>
            <div className="space-y-2"><Label>IBAN</Label><Input value={iban} onChange={(e) => setIban(e.target.value)} /></div>
          </>}
          <div className="space-y-2"><Label>Valyuta</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{['AZN', 'USD', 'EUR', 'TRY', 'RUB'].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Əlavə et</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
