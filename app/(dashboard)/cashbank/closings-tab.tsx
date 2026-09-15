'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, AlertTriangle, ClipboardCheck } from 'lucide-react';
import {
  listDailyClosings, createDailyClosing, listCashRegisters, listCashTransactions,
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

const THRESHOLD = 5; // fərq həddi (baza valyutası) — üstündə xəbərdarlıq (07 §2.3)
interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function ClosingsTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const tt = useTT();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['dailyClosings', companyId], queryFn: () => listDailyClosings(companyId) });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tt('Gün sonu kassanın fiziki sayımı sistem qalığı ilə tutuşdurulur; fərq həddi', 'The end-of-day physical cash count is compared with the system balance; if the variance threshold')} (±{THRESHOLD} {baseCurrency}) {tt('aşarsa xəbərdarlıq (07 §2.3).', 'is exceeded, a warning is shown (07 §2.3).')}</p>
        <div className="flex gap-2">
          <ExportButton filename="kassa-baglanislari" rows={data ?? []} columns={[
            { header: tt('Tarix', 'Date'), value: 'date' }, { header: tt('Kassa', 'Register'), value: 'cashRegisterName' }, { header: tt('Sistem', 'System'), value: 'systemClosingBalance' },
            { header: tt('Sayım', 'Counted'), value: 'physicallyCountedBalance' }, { header: tt('Fərq', 'Variance'), value: 'variance' },
          ]} />
          {canCreate && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Gün bağla', 'Close day')}</Button>}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Bağlanış yoxdur', 'No closings')} description={tt('Gün sonu kassa sayımı ilə başlayın.', 'Start with an end-of-day cash count.')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{tt('Tarix', 'Date')}</TableHead><TableHead>{tt('Kassa', 'Register')}</TableHead><TableHead className="text-right">{tt('Sistem', 'System')}</TableHead><TableHead className="text-right">{tt('Sayım', 'Counted')}</TableHead><TableHead className="text-right">{tt('Fərq', 'Variance')}</TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((c) => {
                const over = Math.abs(c.variance) > THRESHOLD;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-muted-foreground">{c.date}</TableCell>
                    <TableCell className="font-medium">{c.cashRegisterName}</TableCell>
                    <TableCell className="text-right tnum">{formatCurrency(c.systemClosingBalance, baseCurrency)}</TableCell>
                    <TableCell className="text-right tnum">{formatCurrency(c.physicallyCountedBalance, baseCurrency)}</TableCell>
                    <TableCell className="text-right">
                      {over ? <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" /> {formatCurrency(c.variance, baseCurrency)}</Badge>
                        : <span className={`tnum ${c.variance === 0 ? 'text-muted-foreground' : ''}`}>{formatCurrency(c.variance, baseCurrency)}</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {canCreate && open && <CloseDialog companyId={companyId} actorUid={actorUid} baseCurrency={baseCurrency} onClose={() => setOpen(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['dailyClosings', companyId] })} />}
    </div>
  );
}

function CloseDialog({ companyId, actorUid, baseCurrency, onClose, onSaved }: { companyId: string; actorUid: string; baseCurrency: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [registerId, setRegisterId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [counted, setCounted] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: registers } = useQuery({ queryKey: ['cash', companyId], queryFn: () => listCashRegisters(companyId) });
  const { data: txns } = useQuery({ queryKey: ['cashTransactions', companyId], queryFn: () => listCashTransactions(companyId) });
  const reg = registers?.find((r) => r.id === registerId);
  const dayTxns = (txns ?? []).filter((t) => t.cashRegisterId === registerId && t.transactionDate === date);
  const cashIn = dayTxns.filter((t) => t.type === 'cash_in').reduce((s, t) => s + t.amount, 0);
  const cashOut = dayTxns.filter((t) => t.type === 'cash_out').reduce((s, t) => s + t.amount, 0);
  const system = reg?.currentBalance ?? 0;
  const variance = Math.round(((Number(counted) || 0) - system) * 100) / 100;

  async function save() {
    if (!reg) { toast.error(tt('Kassa seçin', 'Select a register')); return; }
    if (counted === '') { toast.error(tt('Fiziki sayım daxil edin', 'Enter the physical count')); return; }
    setBusy(true);
    try {
      const { variance: v } = await createDailyClosing({ companyId, cashRegisterId: registerId, cashRegisterName: reg.name, date, systemClosingBalance: system, physicallyCountedBalance: Number(counted), totalCashIn: cashIn, totalCashOut: cashOut, closedBy: actorUid });
      toast.success(tt('Gün bağlandı', 'Day closed'), Math.abs(v) > THRESHOLD ? `⚠️ ${tt('Fərq həddi aşıldı', 'Variance threshold exceeded')}: ${formatCurrency(v, baseCurrency)}` : tt('Fərq həddindədir', 'Variance is within threshold'));
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" /> {tt('Gündəlik kassa bağlanışı', 'Daily cash closing')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Kassa', 'Register')}</Label>
              <Select value={registerId} onValueChange={setRegisterId}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
                <SelectContent>{(registers ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>{tt('Tarix', 'Date')}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          {reg && (
            <div className="rounded-lg border border-border/60 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{tt('Bu gün mədaxil:', 'Cash in today:')}</span><span className="tnum">{formatCurrency(cashIn, baseCurrency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{tt('Bu gün məxaric:', 'Cash out today:')}</span><span className="tnum">{formatCurrency(cashOut, baseCurrency)}</span></div>
              <div className="flex justify-between font-medium"><span>{tt('Sistem qalığı:', 'System balance:')}</span><span className="tnum">{formatCurrency(system, baseCurrency)}</span></div>
            </div>
          )}
          <div className="space-y-2"><Label>{tt('Fiziki sayım (nağd)', 'Physical count (cash)')}</Label><Input type="number" value={counted} onChange={(e) => setCounted(e.target.value)} /></div>
          {counted !== '' && <p className={`text-sm font-medium ${Math.abs(variance) > THRESHOLD ? 'text-danger' : 'text-muted-foreground'}`}>{tt('Fərq', 'Variance')}: {formatCurrency(variance, baseCurrency)}{Math.abs(variance) > THRESHOLD ? tt(' — həddi aşır ⚠️', ' — exceeds threshold ⚠️') : ''}</p>}
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} {tt('Bağla', 'Close')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
