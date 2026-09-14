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
import { formatCurrency } from '@/lib/utils/format';
import type { RevaluedItem, ExchangeRate } from '@/types';

const CURRENCIES = ['USD', 'EUR', 'TRY', 'RUB', 'GBP'];
interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function CurrencyTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const [cur, setCur] = useState('USD');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [rate, setRate] = useState('');
  const [busy, setBusy] = useState(false);
  const [reval, setReval] = useState(false);
  const { data: rates, isLoading } = useQuery({ queryKey: ['exchangeRates', companyId], queryFn: () => listExchangeRates(companyId) });
  const { data: revals } = useQuery({ queryKey: ['revaluations', companyId], queryFn: () => listRevaluations(companyId) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['exchangeRates', companyId] }); qc.invalidateQueries({ queryKey: ['revaluations', companyId] }); };

  async function addRate() {
    if (!(Number(rate) > 0)) { toast.error('Məzənnə daxil edin'); return; }
    setBusy(true);
    try { await saveExchangeRate(companyId, date, cur, Number(rate)); toast.success('Məzənnə saxlanıldı'); setRate(''); refresh(); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h3 className="font-semibold">Məzənnələr (baza: {baseCurrency})</h3>
          <div className="flex items-center gap-2">
            <ExportButton filename="mezenneler" rows={rates ?? []} columns={[
              { header: 'Tarix', value: 'date' }, { header: 'Valyuta', value: 'currency' }, { header: 'Məzənnə', value: 'rate' },
            ]} />
            {canCreate && <Button size="sm" onClick={() => setReval(true)}><RefreshCw className="h-4 w-4" /> Dövr sonu yenidən qiymətləndirmə</Button>}
          </div>
        </div>
        {canCreate && (
          <div className="mb-3 flex flex-wrap items-end gap-2 rounded-card border border-border/60 p-3">
            <div className="space-y-1"><Label className="text-xs">Valyuta</Label>
              <Select value={cur} onValueChange={setCur}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Tarix</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" /></div>
            <div className="space-y-1"><Label className="text-xs">1 {cur} = ? {baseCurrency}</Label><Input type="number" step="0.0001" value={rate} onChange={(e) => setRate(e.target.value)} className="w-28" placeholder="1.7000" /></div>
            <Button size="sm" onClick={addRate} disabled={busy}><Plus className="h-4 w-4" /> Əlavə et</Button>
          </div>
        )}
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : (rates ?? []).length === 0 ? <EmptyState title="Məzənnə yoxdur" description="Xarici valyuta əməliyyatları üçün gündəlik məzənnə daxil edin." /> : (
          <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Tarix</TableHead><TableHead>Valyuta</TableHead><TableHead className="text-right">1 vahid = {baseCurrency}</TableHead><TableHead></TableHead></TableRow></TableHeader>
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
          <h3 className="mb-3 font-semibold">Yenidən qiymətləndirmə tarixçəsi (unrealized FX)</h3>
          <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Dövr sonu</TableHead><TableHead>Qələm sayı</TableHead><TableHead className="text-right">Unrealized FX</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {(revals ?? []).map((rv) => (
                  <TableRow key={rv.id}>
                    <TableCell className="font-medium">{rv.periodEndDate}</TableCell>
                    <TableCell>{rv.revaluedItems.length}</TableCell>
                    <TableCell className={`text-right tnum ${rv.totalUnrealizedGainLoss >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(rv.totalUnrealizedGainLoss, baseCurrency)}</TableCell>
                    <TableCell><Badge variant={rv.reversed ? 'secondary' : 'success'}>{rv.reversed ? 'geri qaytarılıb' : 'aktiv'}</Badge></TableCell>
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
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState<RevaluedItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const total = (items ?? []).reduce((s, i) => s + i.unrealizedGainLoss, 0);

  async function compute() {
    setBusy(true);
    try { setItems(await computeRevaluation(companyId, periodEnd, baseCurrency, rates)); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }
  async function post() {
    if (!items || items.length === 0) { toast.error('Yenidən qiymətləndiriləcək açıq FX qələm yoxdur'); return; }
    setBusy(true);
    try { await postRevaluation(companyId, periodEnd, baseCurrency, items, actorUid); toast.success('Yenidən qiymətləndirmə jurnala yazıldı', 'Növbəti dövrdə geri qaytarılmalıdır'); onSaved(); onClose(); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary" /> Dövr sonu FX yenidən qiymətləndirmə (IAS 21)</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="space-y-1"><Label className="text-xs">Dövr sonu tarixi</Label><Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-40" /></div>
            <Button size="sm" variant="outline" onClick={compute} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Hesabla</Button>
          </div>
          <p className="text-xs text-muted-foreground">Açıq xarici valyuta fakturaları, kreditor borcları və bank qalıqları dövr sonu kursu ilə yenidən qiymətləndirilir. Nəticə jurnal yazısı yaradır (növbəti dövrdə geri qaytarılır).</p>
          {items && (items.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Açıq FX qələm yoxdur.</p> : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Qələm</TableHead><TableHead>Valyuta</TableHead><TableHead className="text-right">Məbləğ</TableHead><TableHead className="text-right">Kurs (orig→son)</TableHead><TableHead className="text-right">Unrealized</TableHead></TableRow></TableHeader>
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
              <p className="mt-2 text-right text-sm font-semibold">Ümumi unrealized FX: <span className={total >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(total, baseCurrency)}</span></p>
            </div>
          ))}
        </div>
        <DialogFooter>{items && items.length > 0 && <Button onClick={post} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : null} Jurnala yaz</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
