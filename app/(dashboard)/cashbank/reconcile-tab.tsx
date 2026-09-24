'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, Wand2, Check, X, Link2 } from 'lucide-react';
import {
  listStatementImports, createStatementImport, updateStatementLines, listBankAccounts, listPayments,
} from '@/lib/firebase/treasury';
import { autoMatch, reconcileSummary, parseStatementText } from '@/lib/treasury/reconcile';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency } from '@/lib/utils/format';
import type { BankStatementImport, StatementLine } from '@/types';

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function ReconcileTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const tt = useTT();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<BankStatementImport | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['statementImports', companyId], queryFn: () => listStatementImports(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['statementImports', companyId] });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tt('Bank çıxarışını idxal edin — sistem ödənişlərlə avtomatik uyğunlaşdırır (07 §5).', 'Import a bank statement — the system automatically matches it with payments (07 §5).')}</p>
        {canCreate && <Button size="sm" onClick={() => setOpen(true)}><Upload className="h-4 w-4" /> {tt('Çıxarış idxal et', 'Import statement')}</Button>}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('İdxal yoxdur', 'No imports')} description={tt('Bank çıxarışını (CSV/mətn) yapışdırıb uyğunlaşdırmanı başladın.', 'Paste a bank statement (CSV/text) and start matching.')} />
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((imp) => {
            const s = reconcileSummary(imp.lines);
            return (
              <Card key={imp.id} className="rounded-card transition-shadow hover:shadow-soft-lg"><CardContent className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{imp.fileName}</p><p className="truncate text-xs text-muted-foreground">{imp.bankAccountName} · {s.total} {tt('sətir', 'lines')}</p></div>
                <Badge variant="success">{s.matched} {tt('uyğun', 'matched')}</Badge>
                {s.unmatched > 0 && <Badge variant="warning">{s.unmatched} {tt('açıq', 'open')}</Badge>}
                <Button variant="outline" size="sm" onClick={() => setDetail(imp)}>{tt('Bax', 'View')}</Button>
              </CardContent></Card>
            );
          })}
        </div>
      )}
      {canCreate && open && <ImportDialog companyId={companyId} actorUid={actorUid} onClose={() => setOpen(false)} onSaved={refresh} onOpenDetail={setDetail} />}
      {detail && <DetailDialog companyId={companyId} imp={detail} baseCurrency={baseCurrency} canCreate={canCreate} onClose={() => setDetail(null)} onSaved={refresh} />}
    </div>
  );
}

function ImportDialog({ companyId, actorUid, onClose, onSaved, onOpenDetail }: { companyId: string; actorUid: string; onClose: () => void; onSaved: () => void; onOpenDetail: (i: BankStatementImport) => void }) {
  const tt = useTT();
  const [bankAccountId, setBankAccountId] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: banks } = useQuery({ queryKey: ['banks', companyId], queryFn: () => listBankAccounts(companyId) });
  const preview = parseStatementText(text);

  async function importIt() {
    const bank = banks?.find((b) => b.id === bankAccountId);
    if (!bank) { toast.error(tt('Bank hesabı seçin', 'Select a bank account')); return; }
    if (preview.length === 0) { toast.error(tt('Oxunan sətir yoxdur', 'No lines parsed'), tt('Format: tarix; təsvir; məbləğ', 'Format: date; description; amount')); return; }
    setBusy(true);
    try {
      const payments = await listPayments(companyId);
      const { lines, matched } = autoMatch(preview, payments);
      const id = await createStatementImport({ companyId, bankAccountId, bankAccountName: bank.accountName, fileName: `çıxarış-${new Date().toISOString().slice(0, 10)}`, lines, importedBy: actorUid });
      toast.success(tt('Çıxarış idxal edildi', 'Statement imported'), `${matched}/${lines.length} ${tt('sətir avtomatik uyğunlaşdırıldı', 'lines auto-matched')}`);
      onSaved(); onClose();
      onOpenDetail({ id, companyId, bankAccountId, bankAccountName: bank.accountName, fileName: `çıxarış`, lines, importedBy: actorUid });
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{tt('Bank çıxarışı idxalı', 'Bank statement import')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>{tt('Bank hesabı', 'Bank account')}</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
              <SelectContent>{(banks ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.accountName} ({b.currency})</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>{tt('Çıxarış (CSV / mətn — hər sətir: tarix; təsvir; məbləğ)', 'Statement (CSV / text — each line: date; description; amount)')}</Label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder={'2026-01-15;Müştəri ödənişi;1180.00\n2026-01-16;Bank komissiyası;-5.00'} className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <p className="text-xs text-muted-foreground">{preview.length} {tt('sətir oxundu · daxil (+) / çıxış (−). Uyğunlaşdırma: məbləğ + tarix (±3 gün).', 'lines parsed · in (+) / out (−). Matching: amount + date (±3 days).')}</p>
        </div>
        <DialogFooter><Button onClick={importIt} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Wand2 className="h-4 w-4" />} {tt('İdxal + avtomatik uyğunlaşdır', 'Import + auto-match')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({ companyId, imp, baseCurrency, canCreate, onClose, onSaved }: { companyId: string; imp: BankStatementImport; baseCurrency: string; canCreate: boolean; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [lines, setLines] = useState<StatementLine[]>(imp.lines);
  const [busy, setBusy] = useState(false);
  const { data: payments } = useQuery({ queryKey: ['payments', companyId], queryFn: () => listPayments(companyId) });
  const s = reconcileSummary(lines);

  function setStatus(id: string, patch: Partial<StatementLine>) { setLines((arr) => arr.map((l) => l.id === id ? { ...l, ...patch } : l)); }
  async function save() { setBusy(true); try { await updateStatementLines(imp.id, lines); toast.success(tt('Uzlaşdırma saxlanıldı', 'Reconciliation saved')); onSaved(); onClose(); } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); } }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{imp.bankAccountName} — {tt('uzlaşdırma', 'reconciliation')}</DialogTitle></DialogHeader>
        <div className="mb-2 flex gap-2 text-sm"><Badge variant="success">{s.matched} {tt('uyğun', 'matched')}</Badge><Badge variant="warning">{s.unmatched} {tt('açıq', 'open')}</Badge><Badge variant="secondary">{s.ignored} {tt('iqnor', 'ignored')}</Badge></div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>{tt('Tarix', 'Date')}</TableHead><TableHead>{tt('Təsvir', 'Description')}</TableHead><TableHead className="text-right">{tt('Məbləğ', 'Amount')}</TableHead><TableHead>{tt('Uyğunluq', 'Match')}</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-muted-foreground">{l.date}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{l.description}</TableCell>
                  <TableCell className={`text-right tnum ${l.amount >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(l.amount, baseCurrency)}</TableCell>
                  <TableCell>
                    {l.matchStatus === 'matched' ? <Badge variant="success"><Link2 className="mr-1 h-3 w-3" /> {tt('uyğun', 'matched')}</Badge>
                      : l.matchStatus === 'ignored' ? <Badge variant="secondary">{tt('iqnor', 'ignored')}</Badge>
                      : canCreate ? (
                        <Select value={l.matchedPaymentId ?? ''} onValueChange={(v) => setStatus(l.id, { matchStatus: 'matched', matchedPaymentId: v })}>
                          <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder={tt('Əl ilə bağla', 'Match manually')} /></SelectTrigger>
                          <SelectContent>{(payments ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.counterpartyRef.name ?? p.direction} · {formatCurrency(p.direction === 'incoming' ? p.amount : -p.amount, baseCurrency)}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : <Badge variant="warning">{tt('açıq', 'open')}</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    {canCreate && l.matchStatus === 'unmatched' && <Button variant="ghost" size="icon" className="h-8 w-8" title={tt('İqnor et', 'Ignore')} onClick={() => setStatus(l.id, { matchStatus: 'ignored' })}><X className="h-4 w-4" /></Button>}
                    {canCreate && l.matchStatus !== 'unmatched' && <Button variant="ghost" size="icon" className="h-8 w-8" title={tt('Geri', 'Undo')} onClick={() => setStatus(l.id, { matchStatus: 'unmatched', matchedPaymentId: null })}><Check className="h-4 w-4" /></Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : null} {tt('Yadda saxla', 'Save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
