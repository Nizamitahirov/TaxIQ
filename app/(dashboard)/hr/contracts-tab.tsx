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
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency } from '@/lib/utils/format';
import type { Company, ServiceContract } from '@/types';

interface Props { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string; company?: Company }
const STATUS_LABEL: Record<ServiceContract['status'], string> = { draft: 'qaralama', active: 'aktiv', completed: 'tamamlanıb', terminated: 'xitam' };
const STATUS_LABEL_EN: Record<ServiceContract['status'], string> = { draft: 'draft', active: 'active', completed: 'completed', terminated: 'terminated' };

export function ContractsTab({ companyId, canCreate, actorUid, baseCurrency, company }: Props) {
  const qc = useQueryClient();
  const tt = useTT();
  const [edit, setEdit] = useState<ServiceContract | null>(null);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['serviceContracts', companyId], queryFn: () => listServiceContracts(companyId) });
  const co = company ?? ({ name: 'Şirkət', baseCurrency } as Company);
  const refresh = () => qc.invalidateQueries({ queryKey: ['serviceContracts', companyId] });

  return (
    <div>
      <div className="mb-3 flex items-start gap-2 rounded-card border border-info/20 bg-info/5 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        {tt('Əmək müqavilələri işçi kartından idarə olunur (İşçilər → ... → «Əmək müqaviləsi»). Burada fiziki/hüquqi şəxslərlə mülki-hüquqi (xidmət) müqavilələri saxlanılır — bunlar əmək münasibəti yaratmır.', 'Labor contracts are managed from the employee card (Employees → ... → “Labor contract”). Here civil-law (service) contracts with individuals/legal entities are stored — these do not create an employment relationship.')}
      </div>
      <div className="mb-4 flex items-center justify-end gap-2">
        <ExportButton filename="xidmet-muqavileleri" rows={data ?? []} columns={[
          { header: tt('Nömrə', 'Number'), value: 'contractNumber' }, { header: tt('İcraçı', 'Contractor'), value: 'contractorName' }, { header: tt('Tip', 'Type'), value: (c) => (c.contractorType === 'individual' ? tt('Fiziki', 'Individual') : tt('Hüquqi', 'Legal')) },
          { header: tt('Predmet', 'Subject'), value: 'subject' }, { header: tt('Başlanğıc', 'Start'), value: 'startDate' }, { header: tt('Son', 'End'), value: (c) => c.endDate ?? '' },
          { header: tt('Məbləğ', 'Amount'), value: 'amount' }, { header: 'Status', value: 'status' },
        ]} />
        {canCreate && <Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" /> {tt('Yeni müqavilə', 'New contract')}</Button>}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Xidmət müqaviləsi yoxdur', 'No service contracts')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>№</TableHead><TableHead>{tt('İcraçı', 'Contractor')}</TableHead><TableHead>{tt('Predmet', 'Subject')}</TableHead><TableHead>{tt('Müddət', 'Term')}</TableHead><TableHead className="text-right">{tt('Məbləğ', 'Amount')}</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-sm">{c.contractNumber}</TableCell>
                  <TableCell className="font-medium">{c.contractorName}<span className="block text-xs text-muted-foreground">{c.contractorType === 'individual' ? tt('Fiziki şəxs', 'Individual') : tt('Hüquqi şəxs', 'Legal entity')}{c.contractorId ? ` · ${c.contractorId}` : ''}</span></TableCell>
                  <TableCell className="max-w-[220px] truncate">{c.subject}</TableCell>
                  <TableCell className="text-muted-foreground">{c.startDate}{c.endDate ? ` — ${c.endDate}` : ''}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(c.amount, c.currency)}</TableCell>
                  <TableCell><Badge variant={c.status === 'active' ? 'success' : c.status === 'terminated' ? 'destructive' : 'secondary'}>{tt(STATUS_LABEL[c.status], STATUS_LABEL_EN[c.status])}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={tt('Çap', 'Print')} onClick={() => printServiceContract(c, co)}><Printer className="h-4 w-4" /></Button>
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
  const tt = useTT();
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
    if (!form.name.trim() || !form.subject.trim()) { toast.error(tt('İcraçı və predmet tələb olunur', 'Contractor and subject are required')); return; }
    setSaving(true);
    try {
      const payload = {
        companyId, contractorName: form.name.trim(), contractorId: form.cid.trim() || null, contractorType: form.ctype as 'individual' | 'legal',
        subject: form.subject.trim(), startDate: form.start, endDate: form.end || null, amount: Number(form.amount) || 0, currency: baseCurrency,
        paymentTerms: form.terms.trim() || null, withholdTax: form.withhold, status: form.status as ServiceContract['status'],
      };
      if (edit) { await updateServiceContract(edit.id, payload); toast.success(tt('Müqavilə yeniləndi', 'Contract updated')); }
      else { const num = await nextServiceContractNumber(companyId); await createServiceContract({ ...payload, contractNumber: num, createdBy: actorUid }); toast.success(tt('Müqavilə yaradıldı', 'Contract created')); }
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{edit ? tt('Müqaviləni redaktə et', 'Edit contract') : tt('Yeni xidmət müqaviləsi', 'New service contract')}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2"><Label>{tt('İcraçı', 'Contractor')}</Label><Input value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="space-y-2"><Label>{tt('İcraçı tipi', 'Contractor type')}</Label>
            <Select value={form.ctype} onValueChange={(v) => set({ ctype: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="individual">{tt('Fiziki şəxs', 'Individual')}</SelectItem><SelectItem value="legal">{tt('Hüquqi şəxs', 'Legal entity')}</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>{form.ctype === 'individual' ? 'FİN' : 'VÖEN'}</Label><Input value={form.cid} onChange={(e) => set({ cid: e.target.value })} /></div>
          <div className="space-y-2"><Label>{tt('Məbləğ', 'Amount')} ({baseCurrency})</Label><Input type="number" value={form.amount} onChange={(e) => set({ amount: e.target.value })} /></div>
          <div className="col-span-2 space-y-2"><Label>{tt('Predmet', 'Subject')}</Label><Input value={form.subject} onChange={(e) => set({ subject: e.target.value })} /></div>
          <div className="space-y-2"><Label>{tt('Başlanğıc', 'Start')}</Label><Input type="date" value={form.start} onChange={(e) => set({ start: e.target.value })} /></div>
          <div className="space-y-2"><Label>{tt('Son (opsional)', 'End (optional)')}</Label><Input type="date" value={form.end} onChange={(e) => set({ end: e.target.value })} /></div>
          <div className="col-span-2 space-y-2"><Label>{tt('Ödəniş şərtləri', 'Payment terms')}</Label><Input value={form.terms} onChange={(e) => set({ terms: e.target.value })} /></div>
          <div className="space-y-2"><Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => set({ status: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_LABEL).map(([k2, v]) => <SelectItem key={k2} value={k2}>{tt(v, STATUS_LABEL_EN[k2 as ServiceContract['status']])}</SelectItem>)}</SelectContent></Select>
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={form.withhold} onChange={(e) => set({ withhold: e.target.checked })} /> {tt('Ödəniş mənbəyində vergi tutulur (fiziki şəxs)', 'Tax withheld at source (individual)')}</label>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : null} {tt('Yadda saxla', 'Save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
