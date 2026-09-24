'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, RefreshCw, TrendingUp } from 'lucide-react';
import {
  listExchangeRates, saveExchangeRate, deleteExchangeRate, computeRevaluation, postRevaluation, listRevaluations,
} from '@/lib/firebase/treasury';
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
import { formatCurrency } from '@/lib/utils/format';
import type { RevaluedItem, ExchangeRate } from '@/types';

const CURRENCIES = ['USD', 'EUR', 'TRY', 'RUB', 'GBP'];
interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function CurrencyTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const tt = useTT();
  const [cur, setCur] = useState('USD');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [reval, setReval] = useState(false);
  const { data: rates, isLoading } = useQuery({ queryKey: ['exchangeRates', companyId], queryFn: () => listExchangeRates(companyId) });
  const { data: revals } = useQuery({ queryKey: ['revaluations', companyId], queryFn: () => listRevaluations(companyId) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['exchangeRates', companyId] }); qc.invalidateQueries({ queryKey: ['revaluations', companyId] }); };

  async function addRate() {
    if (!(Number(rate) > 0)) { toast.error(tt('Məzənnə daxil edin', 'Enter a rate')); return; }
    setBusy(true);
    try { await saveExchangeRate(companyId, date, cur, Number(rate)); toast.success(tt('Məzənnə saxlanıldı', 'Rate saved')); setRate(''); refresh(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h3 className="font-semibold">{tt('Məzənnələr', 'Exchange rates')} ({tt('baza', 'base')}: {baseCurrency})</h3>
          <div className="flex items-center gap-2">
            <ExportButton filename="mezenneler" rows={rates ?? []} columns={[
              { header: tt('Tarix', 'Date'), value: 'date' }, { header: tt('Valyuta', 'Currency'), value: 'currency' }, { header: tt('Məzənnə', 'Rate'), value: 'rate' },
            ]} />
            {canCreate && <Button size="sm" onClick={() => setReval(true)}><RefreshCw className="h-4 w-4" /> {tt('Dövr sonu yenidən qiymətləndirmə', 'Period-end revaluation')}</Button>}
          </div>
        </div>
        {canCreate && (
          <div className="mb-3 flex flex-wrap items-end gap-2 rounded-card border border-border/60 p-3">
            <div className="space-y-1"><Label className="text-xs">{tt('Valyuta', 'Currency')}</Label>
              <Select value={cur} onValueChange={setCur}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">{tt('Tarix', 'Date')}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" /></div>
            <div className="space-y-1"><Label className="text-xs">1 {cur} = ? {baseCurrency}</Label><Input type="number" step="0.0001" value={rate} onChange={(e) => setRate(e.target.value)} className="w-28" placeholder="1.7000" /></div>
            <Button size="sm" onClick={addRate} disabled={busy}><Plus className="h-4 w-4" /> {tt('Əlavə et', 'Add')}</Button>
          </div>
        )}
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (rates ?? []).length === 0 ? <EmptyState title={tt('Məzənnə yoxdur', 'No rates')} description={tt('Xarici valyuta əməliyyatları üçün gündəlik məzənnə daxil edin.', 'Enter daily rates for foreign currency transactions.')} /> : (
          <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{tt('Tarix', 'Date')}</TableHead><TableHead>{tt('Valyuta', 'Currency')}</TableHead><TableHead className="text-right">1 {tt('vahid', 'unit')} = {baseCurrency}</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {(rates ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">{r.date}</TableCell>
                    <TableCell className="font-medium">{r.currency}</TableCell>
                    <TableCell className="text-right tnum">{r.rate.toFixed(4)}</TableCell>
                    <TableCell className="text-right">{canCreate && <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={async () => { await deleteExchangeRate(r.id); refresh(); }}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        )}
      </div>

      {(revals ?? []).length > 0 && (
        <div>
          <h3 className="mb-3 font-semibold">{tt('Yenidən qiymətləndirmə tarixçəsi (unrealized FX)', 'Revaluation history (unrealized FX)')}</h3>
          <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>{tt('Dövr sonu', 'Period end')}</TableHead><TableHead>{tt('Qələm sayı', 'Item count')}</TableHead><TableHead className="text-right">Unrealized FX</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {(revals ?? []).map((rv) => (
                  <TableRow key={rv.id}>
                    <TableCell className="font-medium">{rv.periodEndDate}</TableCell>
                    <TableCell>{rv.revaluedItems.length}</TableCell>
                    <TableCell className={`text-right tnum ${rv.totalUnrealizedGainLoss >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(rv.totalUnrealizedGainLoss, baseCurrency)}</TableCell>
                    <TableCell><Badge variant={rv.reversed ? 'secondary' : 'success'}>{rv.reversed ? tt('geri qaytarılıb', 'reversed') : tt('aktiv', 'active')}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </div>
      )}

      {reval && <RevalDialog companyId={companyId} actorUid={actorUid} baseCurrency={baseCurrency} rates={rates ?? []} onClose={() => setReval(false)} onSaved={refresh} />}
    </div>
  );
}

function RevalDialog({ companyId, actorUid, baseCurrency, rates, onClose, onSaved }: {
  companyId: string; actorUid: string; baseCurrency: string; rates: ExchangeRate[]; onClose: () => void; onSaved: () => void;
}) {
  const tt = useTT();
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<RevaluedItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const total = (items ?? []).reduce((s, i) => s + i.unrealizedGainLoss, 0);

  async function compute() {
    setBusy(true);
    try { setItems(await computeRevaluation(companyId, periodEnd, baseCurrency, rates)); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }
  async function post() {
    if (!items || items.length === 0) { toast.error(tt('Yenidən qiymətləndiriləcək açıq FX qələm yoxdur', 'No open FX items to revalue')); return; }
    setBusy(true);
    try { await postRevaluation(companyId, periodEnd, baseCurrency, items, actorUid); toast.success(tt('Yenidən qiymətləndirmə jurnala yazıldı', 'Revaluation posted to journal'), tt('Növbəti dövrdə geri qaytarılmalıdır', 'Must be reversed in the next period')); onSaved(); onClose(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> {tt('Dövr sonu FX yenidən qiymətləndirmə (IAS 21)', 'Period-end FX revaluation (IAS 21)')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="space-y-1"><Label className="text-xs">{tt('Dövr sonu tarixi', 'Period-end date')}</Label><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-40" /></div>
            <Button size="sm" variant="outline" onClick={compute} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {tt('Hesabla', 'Compute')}</Button>
          </div>
          <p className="text-xs text-muted-foreground">{tt('Açıq xarici valyuta fakturaları, kreditor borcları və bank qalıqları dövr sonu kursu ilə yenidən qiymətləndirilir. Nəticə jurnal yazısı yaradır (növbəti dövrdə geri qaytarılır).', 'Open foreign-currency invoices, payables and bank balances are revalued at the period-end rate. The result creates a journal entry (reversed in the next period).')}</p>
          {items && (items.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">{tt('Açıq FX qələm yoxdur.', 'No open FX items.')}</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>{tt('Qələm', 'Item')}</TableHead><TableHead>{tt('Valyuta', 'Currency')}</TableHead><TableHead className="text-right">{tt('Məbləğ', 'Amount')}</TableHead><TableHead className="text-right">{tt('Kurs (orig→son)', 'Rate (orig→close)')}</TableHead><TableHead className="text-right">Unrealized</TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map((it, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{it.label}</TableCell>
                      <TableCell>{it.currency}</TableCell>
                      <TableCell className="text-right tnum">{it.foreignAmount.toFixed(2)}</TableCell>
                      <TableCell className="text-right tnum text-muted-foreground">{it.originalRate.toFixed(4)}→{it.closingRate.toFixed(4)}</TableCell>
                      <TableCell className={`text-right tnum ${it.unrealizedGainLoss >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(it.unrealizedGainLoss, baseCurrency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-2 text-right text-sm font-semibold">{tt('Ümumi unrealized FX', 'Total unrealized FX')}: <span className={total >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(total, baseCurrency)}</span></p>
            </div>
          ))}
        </div>
        <DialogFooter>{items && items.length > 0 && <Button onClick={post} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : null} {tt('Jurnala yaz', 'Post to journal')}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
