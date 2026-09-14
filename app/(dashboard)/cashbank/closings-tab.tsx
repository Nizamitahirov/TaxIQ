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
import { formatCurrency } from '@/lib/utils/format';

const THRESHOLD = 5; // fərq həddi (baza valyutası) — üstündə xəbərdarlıq (07 §2.3)
interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function ClosingsTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['dailyClosings', companyId], queryFn: () => listDailyClosings(companyId) });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gün sonu kassanın fiziki sayımı sistem qalığı ilə tutuşdurulur; fərq həddi (±{THRESHOLD} {baseCurrency}) aşarsa xəbərdarlıq (07 §2.3).</p>
        <div className="flex gap-2">
          <ExportButton filename="kassa-baglanislari" rows={data ?? []} columns={[
            { header: 'Tarix', value: 'date' }, { header: 'Kassa', value: 'cashRegisterName' }, { header: 'Sistem', value: 'systemClosingBalance' },
            { header: 'Sayım', value: 'physicallyCountedBalance' }, { header: 'Fərq', value: 'variance' },
          ]} />
          {canCreate && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Gün bağla</Button>}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Bağlanış yoxdur" description="Gün sonu kassa sayımı ilə başlayın." />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Tarix</TableHead><TableHead>Kassa</TableHead><TableHead className="text-right">Sistem</TableHead><TableHead className="text-right">Sayım</TableHead><TableHead className="text-right">Fərq</TableHead></TableRow></TableHeader>
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
    if (!reg) { toast.error('Kassa seçin'); return; }
    if (counted === '') { toast.error('Fiziki sayım daxil edin'); return; }
    setBusy(true);
    try {
      const { variance: v } = await createDailyClosing({ companyId, cashRegisterId: registerId, cashRegisterName: reg.name, date, systemClosingBalance: system, physicallyCountedBalance: Number(counted), totalCashIn: cashIn, totalCashOut: cashOut, closedBy: actorUid });
      toast.success('Gün bağlandı', Math.abs(v) > THRESHOLD ? `⚠️ Fərq həddi aşıldı: ${formatCurrency(v, baseCurrency)}` : 'Fərq həddindədir');
      onSaved(); onClose();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" /> Gündəlik kassa bağlanışı</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Kassa</Label>
              <Select value={registerId} onValueChange={setRegisterId}><SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                <SelectContent>{(registers ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Tarix</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          </div>
          {reg && (
            <div className="rounded-lg border border-border/60 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Bu gün mədaxil:</span><span className="tnum">{formatCurrency(cashIn, baseCurrency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Bu gün məxaric:</span><span className="tnum">{formatCurrency(cashOut, baseCurrency)}</span></div>
              <div className="flex justify-between font-medium"><span>Sistem qalığı:</span><span className="tnum">{formatCurrency(system, baseCurrency)}</span></div>
            </div>
          )}
          <div className="space-y-2"><Label>Fiziki sayım (nağd)</Label><Input type="number" value={counted} onChange={(e) => setCounted(e.target.value)} /></div>
          {counted !== '' && <p className={`text-sm font-medium ${Math.abs(variance) > THRESHOLD ? 'text-danger' : 'text-muted-foreground'}`}>Fərq: {formatCurrency(variance, baseCurrency)}{Math.abs(variance) > THRESHOLD ? ' — həddi aşır ⚠️' : ''}</p>}
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <ClipboardCheck className="h-4 w-4" />} Bağla</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
