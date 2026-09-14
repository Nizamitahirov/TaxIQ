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
import { formatCurrency } from '@/lib/utils/format';
import type { BankFileFormat, PaymentOrderBatch, PaymentOrderItem } from '@/types';

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function BulkTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const [fmtOpen, setFmtOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const { data: formats } = useQuery({ queryKey: ['bankFormats', companyId], queryFn: () => listBankFileFormats(companyId) });
  const { data: batches, isLoading } = useQuery({ queryKey: ['paymentBatches', companyId], queryFn: () => listPaymentBatches(companyId) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['paymentBatches', companyId] }); qc.invalidateQueries({ queryKey: ['bankFormats', companyId] }); };

  function download(batch: PaymentOrderBatch, fmt: BankFileFormat) {
    downloadBankFile(fmt, batch.items);
    markBatchExported(batch.id).then(refresh);
    toast.success('Bank faylı endirildi', `${fmt.bankName} formatı`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Konfiqurasiya edilə bilən bank formatları ilə toplu ödəniş/əmək haqqı faylları (07 §1.2, §4.3).</p>
        <div className="flex gap-2">
          {canCreate && <Button size="sm" variant="outline" onClick={() => setFmtOpen(true)}><Settings2 className="h-4 w-4" /> Format profilləri</Button>}
          {canCreate && <Button size="sm" onClick={() => setBatchOpen(true)}><Plus className="h-4 w-4" /> Toplu ödəniş</Button>}
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (batches ?? []).length === 0 ? (
        <EmptyState title="Toplu ödəniş yoxdur" description="Açıq kreditor fakturalarından toplu ödəniş faylı yaradın." />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Tip</TableHead><TableHead>Bank hesabı</TableHead><TableHead>Say</TableHead><TableHead className="text-right">Məbləğ</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(batches ?? []).map((b) => (
                <TableRow key={b.id}>
                  <TableCell><Badge variant="secondary">{b.batchType === 'salary_bulk' ? 'Əmək haqqı' : 'Kreditor'}</Badge></TableCell>
                  <TableCell className="font-medium">{b.bankAccountName}</TableCell>
                  <TableCell>{b.items.length}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(b.totalAmount, baseCurrency)}</TableCell>
                  <TableCell><Badge variant={b.status === 'confirmed' ? 'success' : b.status === 'exported' ? 'warning' : 'secondary'}>{b.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Select onValueChange={(fid) => { const fmt = (formats ?? []).find((f) => f.id === fid); if (fmt) download(b, fmt); }}>
                        <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Fayl endir" /></SelectTrigger>
                        <SelectContent>{(formats ?? []).length === 0 ? <SelectItem value="_none" disabled>Format yoxdur</SelectItem> : (formats ?? []).map((f) => <SelectItem key={f.id} value={f.id}>{f.bankName}</SelectItem>)}</SelectContent>
                      </Select>
                      {canCreate && b.status !== 'confirmed' && <Button variant="ghost" size="icon" className="h-8 w-8 text-success" title="Təsdiqlə" onClick={async () => { await confirmPaymentBatch(b, baseCurrency, actorUid); refresh(); toast.success('Təsdiqləndi'); }}><Check className="h-4 w-4" /></Button>}
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
  const [bankName, setBankName] = useState('');
  const [delimiter, setDelimiter] = useState<',' | ';' | '\t'>(';');
  const [ext, setExt] = useState<'txt' | 'csv'>('txt');
  const [header, setHeader] = useState(false);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!bankName.trim()) { toast.error('Bank adı tələb olunur'); return; }
    setBusy(true);
    try {
      const base = defaultBankFormat(companyId, bankName.trim());
      await createBankFileFormat({ ...base, delimiter, fileExtension: ext, includeHeader: header });
      toast.success('Format profili əlavə edildi'); setBankName(''); onSaved();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Bank fayl format profilləri</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {formats.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border border-border/60 p-2 text-sm">
              <div><p className="font-medium">{f.bankName}</p><p className="text-xs text-muted-foreground">.{f.fileExtension} · ayırıcı «{f.delimiter === '\t' ? 'tab' : f.delimiter}» · {f.columns.length} sütun</p></div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={async () => { await deleteBankFileFormat(f.id); onSaved(); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <div className="rounded-lg border border-dashed border-border p-3">
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Yeni profil (sütunlar: {BANK_FILE_FIELDS.map((f) => f.key).join(', ')})</p>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Bank adı (PASHA Bank)" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              <Select value={delimiter} onValueChange={(v) => setDelimiter(v as typeof delimiter)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value=";">Nöqtəli vergül (;)</SelectItem><SelectItem value=",">Vergül (,)</SelectItem><SelectItem value={'\t'}>Tab</SelectItem></SelectContent></Select>
              <Select value={ext} onValueChange={(v) => setExt(v as typeof ext)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="txt">.txt</SelectItem><SelectItem value="csv">.csv</SelectItem></SelectContent></Select>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={header} onChange={(e) => setHeader(e.target.checked)} /> Başlıq sətri</label>
            </div>
            <Button size="sm" className="mt-2" onClick={add} disabled={busy}><Plus className="h-4 w-4" /> Əlavə et</Button>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Bağla</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BatchDialog({ companyId, actorUid, baseCurrency, onClose, onSaved }: { companyId: string; actorUid: string; baseCurrency: string; onClose: () => void; onSaved: () => void }) {
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
    if (!bank) { toast.error('Bank hesabı seçin'); return; }
    const items: PaymentOrderItem[] = open.filter((b) => selected.has(b.id)).map((b) => ({
      beneficiaryIban: vendorIban(b.vendorId), beneficiaryName: b.vendorName ?? '', amount: b.amountDue, purposeText: `Faktura ${b.billNumber}`, sourceType: 'purchaseBill', sourceId: b.id,
    }));
    if (items.length === 0) { toast.error('Ən azı 1 faktura seçin'); return; }
    setBusy(true);
    try {
      await createPaymentBatch({ companyId, bankAccountId, bankAccountName: bank.accountName, batchType: 'vendor_bulk', items, createdBy: actorUid });
      toast.success('Toplu ödəniş yaradıldı', 'Format seçib faylı endirin'); onSaved(); onClose();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Banknote className="h-5 w-5 text-primary" /> Toplu kreditor ödənişi</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Ödəyən bank hesabı</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}><SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
              <SelectContent>{(banks ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.accountName} ({b.currency})</SelectItem>)}</SelectContent></Select>
          </div>
          {open.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">Açıq kreditor faktura yoxdur.</p> : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader><TableRow><TableHead></TableHead><TableHead>Faktura</TableHead><TableHead>Təchizatçı</TableHead><TableHead className="text-right">Qalıq</TableHead></TableRow></TableHeader>
                <TableBody>
                  {open.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell><input type="checkbox" checked={selected.has(b.id)} onChange={(e) => setSelected((s) => { const n = new Set(s); if (e.target.checked) n.add(b.id); else n.delete(b.id); return n; })} /></TableCell>
                      <TableCell className="font-mono text-xs">{b.billNumber}</TableCell>
                      <TableCell>{b.vendorName}{!vendorIban(b.vendorId) && <span className="ml-1 text-xs text-warning-foreground">(IBAN yox)</span>}</TableCell>
                      <TableCell className="text-right tnum">{formatCurrency(b.amountDue, b.currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Partiya yarat ({selected.size})</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
