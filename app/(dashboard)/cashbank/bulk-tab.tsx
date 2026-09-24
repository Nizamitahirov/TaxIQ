'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Download, Trash2, Settings2, Check, Banknote } from 'lucide-react';
import {
  listBankFileFormats, createBankFileFormat, deleteBankFileFormat,
  listPaymentBatches, createPaymentBatch, markBatchExported, confirmPaymentBatch,
  listBankAccounts, listPurchaseBills, listVendors,
} from '@/lib/firebase/treasury';
import { downloadBankFile, defaultBankFormat, BANK_FILE_FIELDS } from '@/lib/treasury/bankfile';
import { EmptyState } from '@/components/shared/empty-state';
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
import type { BankFileFormat, PaymentOrderBatch, PaymentOrderItem } from '@/types';

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function BulkTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const tt = useTT();
  const [fmtOpen, setFmtOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const { data: formats } = useQuery({ queryKey: ['bankFormats', companyId], queryFn: () => listBankFileFormats(companyId) });
  const { data: batches, isLoading } = useQuery({ queryKey: ['paymentBatches', companyId], queryFn: () => listPaymentBatches(companyId) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['paymentBatches', companyId] }); qc.invalidateQueries({ queryKey: ['bankFormats', companyId] }); };

  function download(batch: PaymentOrderBatch, fmt: BankFileFormat) {
    downloadBankFile(fmt, batch.items);
    markBatchExported(batch.id).then(refresh);
    toast.success(tt('Bank faylı endirildi', 'Bank file downloaded'), `${fmt.bankName} ${tt('formatı', 'format')}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{tt('Konfiqurasiya edilə bilən bank formatları ilə toplu ödəniş/əmək haqqı faylları (07 §1.2, §4.3).', 'Bulk payment/payroll files with configurable bank formats (07 §1.2, §4.3).')}</p>
        <div className="flex gap-2">
          {canCreate && <Button size="sm" variant="outline" onClick={() => setFmtOpen(true)}><Settings2 className="h-4 w-4" /> {tt('Format profilləri', 'Format profiles')}</Button>}
          {canCreate && <Button size="sm" onClick={() => setBatchOpen(true)}><Plus className="h-4 w-4" /> {tt('Toplu ödəniş', 'Bulk payment')}</Button>}
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (batches ?? []).length === 0 ? (
        <EmptyState title={tt('Toplu ödəniş yoxdur', 'No bulk payments')} description={tt('Açıq kreditor fakturalarından toplu ödəniş faylı yaradın.', 'Create a bulk payment file from open purchase bills.')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{tt('Tip', 'Type')}</TableHead><TableHead>{tt('Bank hesabı', 'Bank account')}</TableHead><TableHead>{tt('Say', 'Count')}</TableHead><TableHead className="text-right">{tt('Məbləğ', 'Amount')}</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(batches ?? []).map((b) => (
                <TableRow key={b.id}>
                  <TableCell><Badge variant="secondary">{b.batchType === 'salary_bulk' ? tt('Əmək haqqı', 'Payroll') : tt('Kreditor', 'Payables')}</Badge></TableCell>
                  <TableCell className="font-medium">{b.bankAccountName}</TableCell>
                  <TableCell>{b.items.length}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(b.totalAmount, baseCurrency)}</TableCell>
                  <TableCell><Badge variant={b.status === 'confirmed' ? 'success' : b.status === 'exported' ? 'warning' : 'secondary'}>{b.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Select onValueChange={(fid) => { const fmt = (formats ?? []).find((f) => f.id === fid); if (fmt) download(b, fmt); }}>
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder={tt('Fayl endir', 'Download file')} /></SelectTrigger>
                        <SelectContent>{(formats ?? []).length === 0 ? <SelectItem value="_none" disabled>{tt('Format yoxdur', 'No format')}</SelectItem> : (formats ?? []).map((f) => <SelectItem key={f.id} value={f.id}>{f.bankName}</SelectItem>)}</SelectContent>
                      </Select>
                      {canCreate && b.status !== 'confirmed' && <Button variant="ghost" size="icon" className="h-8 w-8 text-success" title={tt('Təsdiqlə', 'Confirm')} onClick={async () => { await confirmPaymentBatch(b, baseCurrency, actorUid); refresh(); toast.success(tt('Təsdiqləndi', 'Confirmed')); }}><Check className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      {canCreate && fmtOpen && <FormatsDialog companyId={companyId} formats={formats ?? []} onClose={() => setFmtOpen(false)} onSaved={refresh} />}
      {canCreate && batchOpen && <BatchDialog companyId={companyId} actorUid={actorUid} baseCurrency={baseCurrency} onClose={() => setBatchOpen(false)} onSaved={refresh} />}
    </div>
  );
}

function FormatsDialog({ companyId, formats, onClose, onSaved }: { companyId: string; formats: BankFileFormat[]; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [bankName, setBankName] = useState('');
  const [delimiter, setDelimiter] = useState<',' | ';' | '\t'>(';');
  const [ext, setExt] = useState<'txt' | 'csv'>('txt');
  const [header, setHeader] = useState(false);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!bankName.trim()) { toast.error(tt('Bank adı tələb olunur', 'Bank name is required')); return; }
    setBusy(true);
    try {
      const base = defaultBankFormat(companyId, bankName.trim());
      await createBankFileFormat({ ...base, delimiter, fileExtension: ext, includeHeader: header });
      toast.success(tt('Format profili əlavə edildi', 'Format profile added')); setBankName(''); onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{tt('Bank fayl format profilləri', 'Bank file format profiles')}</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {formats.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2 text-sm">
              <div><p className="font-medium">{f.bankName}</p><p className="text-xs text-muted-foreground">.{f.fileExtension} · {tt('ayırıcı', 'delimiter')} «{f.delimiter === '\t' ? 'tab' : f.delimiter}» · {f.columns.length} {tt('sütun', 'columns')}</p></div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={async () => { await deleteBankFileFormat(f.id); onSaved(); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <div className="rounded-lg border border-dashed border-border p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">{tt('Yeni profil (sütunlar:', 'New profile (columns:')} {BANK_FILE_FIELDS.map((f) => f.key).join(', ')})</p>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder={tt('Bank adı (PASHA Bank)', 'Bank name (PASHA Bank)')} value={bankName} onChange={(e) => setBankName(e.target.value)} />
              <Select value={delimiter} onValueChange={(v) => setDelimiter(v as typeof delimiter)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value=";">{tt('Nöqtəli vergül (;)', 'Semicolon (;)')}</SelectItem><SelectItem value=",">{tt('Vergül (,)', 'Comma (,)')}</SelectItem><SelectItem value={'\t'}>Tab</SelectItem></SelectContent></Select>
              <Select value={ext} onValueChange={(v) => setExt(v as typeof ext)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="txt">.txt</SelectItem><SelectItem value="csv">.csv</SelectItem></SelectContent></Select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} /> {tt('Başlıq sətri', 'Header row')}</label>
            </div>
            <Button size="sm" className="mt-2" onClick={add} disabled={busy}><Plus className="h-4 w-4" /> {tt('Əlavə et', 'Add')}</Button>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Bağla', 'Close')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BatchDialog({ companyId, actorUid, baseCurrency, onClose, onSaved }: { companyId: string; actorUid: string; baseCurrency: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [bankAccountId, setBankAccountId] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const { data: banks } = useQuery({ queryKey: ['banks', companyId], queryFn: () => listBankAccounts(companyId) });
  const { data: bills } = useQuery({ queryKey: ['purchaseBills', companyId], queryFn: () => listPurchaseBills(companyId) });
  const { data: vendors } = useQuery({ queryKey: ['vendors', companyId], queryFn: () => listVendors(companyId) });
  const open = (bills ?? []).filter((b) => ['approved', 'partially_paid', 'overdue'].includes(b.status) && (b.amountDue ?? 0) > 0);
  const vendorIban = (id: string) => vendors?.find((v) => v.id === id)?.iban ?? '';

  async function save() {
    const bank = banks?.find((b) => b.id === bankAccountId);
    if (!bank) { toast.error(tt('Bank hesabı seçin', 'Select a bank account')); return; }
    const items: PaymentOrderItem[] = open.filter((b) => selected.has(b.id)).map((b) => ({
      beneficiaryIban: vendorIban(b.vendorId), beneficiaryName: b.vendorName ?? '', amount: b.amountDue, purposeText: `Faktura ${b.billNumber}`, sourceType: 'purchaseBill', sourceId: b.id,
    }));
    if (items.length === 0) { toast.error(tt('Ən azı 1 faktura seçin', 'Select at least 1 bill')); return; }
    setBusy(true);
    try {
      await createPaymentBatch({ companyId, bankAccountId, bankAccountName: bank.accountName, batchType: 'vendor_bulk', items, createdBy: actorUid });
      toast.success(tt('Toplu ödəniş yaradıldı', 'Bulk payment created'), tt('Format seçib faylı endirin', 'Select a format and download the file')); onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Banknote className="h-5 w-5 text-primary" /> {tt('Toplu kreditor ödənişi', 'Bulk supplier payment')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>{tt('Ödəyən bank hesabı', 'Paying bank account')}</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
              <SelectContent>{(banks ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.accountName} ({b.currency})</SelectItem>)}</SelectContent></Select>
          </div>
          {open.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">{tt('Açıq kreditor faktura yoxdur.', 'No open purchase bills.')}</p> : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader><TableRow><TableHead></TableHead><TableHead>{tt('Faktura', 'Bill')}</TableHead><TableHead>{tt('Təchizatçı', 'Supplier')}</TableHead><TableHead className="text-right">{tt('Qalıq', 'Balance')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {open.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell><input type="checkbox" checked={selected.has(b.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(b.id); else n.delete(b.id); return n; })} /></TableCell>
                      <TableCell className="font-mono text-xs">{b.billNumber}</TableCell>
                      <TableCell>{b.vendorName}{!vendorIban(b.vendorId) && <span className="ml-1 text-xs text-warning-foreground">{tt('(IBAN yox)', '(no IBAN)')}</span>}</TableCell>
                      <TableCell className="text-right tnum">{formatCurrency(b.amountDue, b.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Partiya yarat', 'Create batch')} ({selected.size})</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
