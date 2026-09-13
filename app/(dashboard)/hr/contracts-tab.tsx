'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Printer, Pencil, Info } from 'lucide-react';
import { listServiceContracts, createServiceContract, updateServiceContract, nextServiceContractNumber } from '@/lib/firebase/hr';
import { printServiceContract } from '@/lib/hr/documents';
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
import type { Company, ServiceContract } from '@/types';

interface Props { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string; company?: Company }
const STATUS_LABEL: Record<ServiceContract['status'], string> = { draft: 'qaralama', active: 'aktiv', completed: 'tamamlanıb', terminated: 'xitam' };

export function ContractsTab({ companyId, canCreate, actorUid, baseCurrency, company }: Props) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<ServiceContract | null>(null);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['serviceContracts', companyId], queryFn: () => listServiceContracts(companyId) });
  const co = company ?? ({ name: 'Şirkət', baseCurrency } as Company);
  const refresh = () => qc.invalidateQueries({ queryKey: ['serviceContracts', companyId] });

  return (
    <div>
      <div className="mb-3 flex items-start gap-2 rounded-card border border-info/20 bg-info/5 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        Əmək müqavilələri işçi kartından idarə olunur (İşçilər → ... → «Əmək müqaviləsi»). Burada fiziki/hüquqi şəxslərlə <b className="mx-1 font-semibold">mülki-hüquqi (xidmət)</b> müqavilələri saxlanılır — bunlar əmək münasibəti yaratmır.
      </div>
      <div className="mb-4 flex items-center justify-end gap-2">
        <ExportButton filename="xidmet-muqavileleri" rows={data ?? []} columns={[
          { header: 'Nömrə', value: 'contractNumber' }, { header: 'İcraçı', value: 'contractorName' }, { header: 'Tip', value: (c) => (c.contractorType === 'individual' ? 'Fiziki' : 'Hüquqi') },
          { header: 'Predmet', value: 'subject' }, { header: 'Başlanğıc', value: 'startDate' }, { header: 'Son', value: (c) => c.endDate ?? '' },
          { header: 'Məbləğ', value: 'amount' }, { header: 'Status', value: 'status' },
        ]} />
        {canCreate && <Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" /> Yeni müqavilə</Button>}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Xidmət müqaviləsi yoxdur" />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>№</TableHead><TableHead>İcraçı</TableHead><TableHead>Predmet</TableHead><TableHead>Müddət</TableHead><TableHead className="text-right">Məbləğ</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm">{c.contractNumber}</TableCell>
                  <TableCell className="font-medium">{c.contractorName}<span className="block text-xs text-muted-foreground">{c.contractorType === 'individual' ? 'Fiziki şəxs' : 'Hüquqi şəxs'}{c.contractorId ? ` · ${c.contractorId}` : ''}</span></TableCell>
                  <TableCell className="max-w-[220px] truncate">{c.subject}</TableCell>
                  <TableCell className="text-muted-foreground">{c.startDate}{c.endDate ? ` — ${c.endDate}` : ''}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(c.amount, c.currency)}</TableCell>
                  <TableCell><Badge variant={c.status === 'active' ? 'success' : c.status === 'terminated' ? 'destructive' : 'secondary'}>{STATUS_LABEL[c.status]}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Çap" onClick={() => printServiceContract(c, co)}><Printer className="h-4 w-4" /></Button>
                      {canCreate && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEdit(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {canCreate && <ContractDialog open={open} onOpenChange={setOpen} companyId={companyId} actorUid={actorUid} baseCurrency={baseCurrency} edit={edit} onSaved={refresh} />}
    </div>
  );
}

function ContractDialog({ open, onOpenChange, companyId, actorUid, baseCurrency, edit, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; baseCurrency: string; edit: ServiceContract | null; onSaved: () => void;
}) {
  const empty = { name: '', cid: '', ctype: 'individual', subject: '', start: new Date().toISOString().slice(0, 10), end: '', amount: '', terms: '', withhold: true, status: 'active' };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState('');

  const k = (edit?.id ?? 'new') + (open ? '1' : '0');
  if (k !== key && open) {
    setKey(k);
    setForm(edit ? { name: edit.contractorName, cid: edit.contractorId ?? '', ctype: edit.contractorType, subject: edit.subject, start: edit.startDate, end: edit.endDate ?? '', amount: String(edit.amount), terms: edit.paymentTerms ?? '', withhold: edit.withholdTax, status: edit.status } : empty);
  }
  const set = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  async function save() {
    if (!form.name.trim() || !form.subject.trim()) { toast.error('İcraçı və predmet tələb olunur'); return; }
    setSaving(true);
    try {
      const payload = {
        companyId, contractorName: form.name.trim(), contractorId: form.cid.trim() || null, contractorType: form.ctype as 'individual' | 'legal',
        subject: form.subject.trim(), startDate: form.start, endDate: form.end || null, amount: Number(form.amount) || 0, currency: baseCurrency,
        paymentTerms: form.terms.trim() || null, withholdTax: form.withhold, status: form.status as ServiceContract['status'],
      };
      if (edit) { await updateServiceContract(edit.id, payload); toast.success('Müqavilə yeniləndi'); }
      else { const num = await nextServiceContractNumber(companyId); await createServiceContract({ ...payload, contractNumber: num, createdBy: actorUid }); toast.success('Müqavilə yaradıldı'); }
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{edit ? 'Müqaviləni redaktə et' : 'Yeni xidmət müqaviləsi'}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>İcraçı</Label><Input value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="space-y-2"><Label>İcraçı tipi</Label>
            <Select value={form.ctype} onValueChange={(v) => set({ ctype: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="individual">Fiziki şəxs</SelectItem><SelectItem value="legal">Hüquqi şəxs</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>{form.ctype === 'individual' ? 'FİN' : 'VÖEN'}</Label><Input value={form.cid} onChange={(e) => set({ cid: e.target.value })} /></div>
          <div className="space-y-2"><Label>Məbləğ ({baseCurrency})</Label><Input type="number" value={form.amount} onChange={(e) => set({ amount: e.target.value })} /></div>
          <div className="col-span-2 space-y-2"><Label>Predmet</Label><Input value={form.subject} onChange={(e) => set({ subject: e.target.value })} /></div>
          <div className="space-y-2"><Label>Başlanğıc</Label><Input type="date" value={form.start} onChange={(e) => set({ start: e.target.value })} /></div>
          <div className="space-y-2"><Label>Son (opsional)</Label><Input type="date" value={form.end} onChange={(e) => set({ end: e.target.value })} /></div>
          <div className="col-span-2 space-y-2"><Label>Ödəniş şərtləri</Label><Input value={form.terms} onChange={(e) => set({ terms: e.target.value })} /></div>
          <div className="space-y-2"><Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set({ status: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_LABEL).map(([k2, v]) => <SelectItem key={k2} value={k2}>{v}</SelectItem>)}</SelectContent></Select>
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.withhold} onChange={(e) => set({ withhold: e.target.checked })} /> Ödəniş mənbəyində vergi tutulur (fiziki şəxs)</label>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : null} Yadda saxla</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
