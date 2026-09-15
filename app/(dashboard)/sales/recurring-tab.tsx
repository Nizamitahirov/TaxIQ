'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Play, Trash2, Power, Repeat } from 'lucide-react';
import {
  listRecurringTemplates, createRecurringTemplate, updateRecurringTemplate, deleteRecurringTemplate,
  generateDueRecurringInvoices, listCustomers, computeTotals,
} from '@/lib/firebase/sales';
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
import { useTT } from '@/lib/i18n/tt';
import { LineItemsEditor, emptyLine, type DraftLine } from './line-items-editor';
import type { RecurringInvoiceTemplate } from '@/types';

const FREQ: Record<string, string> = { monthly: 'Aylıq', quarterly: 'Rüblük', annually: 'İllik' };
const FREQ_EN: Record<string, string> = { monthly: 'Monthly', quarterly: 'Quarterly', annually: 'Annually' };

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function RecurringTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const tt = useTT();
  const freq = (f: string) => tt(FREQ[f] ?? f, FREQ_EN[f] ?? f);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['recurring', companyId], queryFn: () => listRecurringTemplates(companyId) });
  function invalidate() { qc.invalidateQueries({ queryKey: ['recurring', companyId] }); qc.invalidateQueries({ queryKey: ['invoices', companyId] }); }

  async function generate() {
    setBusy(true);
    try { const n = await generateDueRecurringInvoices(companyId, actorUid); toast.success(n > 0 ? `${n} ${tt('faktura yaradıldı', 'invoices created')}` : tt('Vaxtı çatan şablon yoxdur', 'No templates are due')); invalidate(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }
  async function toggle(t: RecurringInvoiceTemplate) { await updateRecurringTemplate(t.id, { isActive: !t.isActive }); invalidate(); }
  async function remove(t: RecurringInvoiceTemplate) { await deleteRecurringTemplate(t.id); toast.success(tt('Silindi', 'Deleted')); invalidate(); }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{tt('Abunə xidmətləri üçün avtomatlaşdırılmış faktura şablonları (06 §4).', 'Automated invoice templates for subscription services (06 §4).')}</p>
        <div className="flex gap-2">
          <ExportButton filename="tekrarlanan-fakturalar" rows={data ?? []} columns={[
            { header: tt('Müştəri', 'Customer'), value: 'customerName' }, { header: tt('Tezlik', 'Frequency'), value: (t) => freq(t.frequency) },
            { header: tt('Növbəti', 'Next'), value: 'nextRunDate' }, { header: tt('Aktiv', 'Active'), value: (t) => (t.isActive ? tt('Bəli', 'Yes') : tt('Xeyr', 'No')) },
          ]} />
          <Button size="sm" variant="outline" onClick={generate} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {tt('Vaxtı çatanları yarat', 'Generate due')}</Button>
          {canCreate && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni şablon', 'New template')}</Button>}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Təkrarlanan şablon yoxdur', 'No recurring templates')} description={tt('Aylıq abunə fakturaları üçün şablon yaradın.', 'Create a template for monthly subscription invoices.')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{tt('Müştəri', 'Customer')}</TableHead><TableHead>{tt('Tezlik', 'Frequency')}</TableHead><TableHead>{tt('Növbəti tarix', 'Next date')}</TableHead><TableHead className="text-right">{tt('Məbləğ', 'Amount')}</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((t) => {
                const total = computeTotals(t.lineItems).grandTotal;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.customerName}</TableCell>
                    <TableCell>{freq(t.frequency)}</TableCell>
                    <TableCell className="text-muted-foreground">{t.nextRunDate}</TableCell>
                    <TableCell className="text-right tnum">{formatCurrency(total, baseCurrency)}</TableCell>
                    <TableCell><Badge variant={t.isActive ? 'success' : 'secondary'}>{t.isActive ? tt('aktiv', 'active') : tt('passiv', 'inactive')}</Badge></TableCell>
                    <TableCell className="text-right">
                      {canCreate && <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggle(t)} title={t.isActive ? tt('Söndür', 'Disable') : tt('Aktivləşdir', 'Enable')}><Power className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => remove(t)}><Trash2 className="h-4 w-4" /></Button>
                      </div>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {canCreate && open && <RecurringDialog companyId={companyId} actorUid={actorUid} baseCurrency={baseCurrency} onClose={() => setOpen(false)} onSaved={invalidate} />}
    </div>
  );
}

function RecurringDialog({ companyId, actorUid, baseCurrency, onClose, onSaved }: { companyId: string; actorUid: string; baseCurrency: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [customerId, setCustomerId] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'quarterly' | 'annually'>('monthly');
  const [nextRunDate, setNextRunDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const { data: customers } = useQuery({ queryKey: ['customers', companyId], queryFn: () => listCustomers(companyId) });

  async function save() {
    const c = customers?.find((x) => x.id === customerId);
    if (!c) { toast.error(tt('Müştəri seçin', 'Select a customer')); return; }
    const valid = lines.filter((l) => l.description && l.unitPrice > 0);
    if (valid.length === 0) { toast.error(tt('Ən azı 1 sətir', 'At least 1 line')); return; }
    setSaving(true);
    try {
      await createRecurringTemplate({
        companyId, customerId, customerName: c.name, lineItems: computeTotals(valid).lines,
        frequency, nextRunDate, endDate: null, isActive: true, lastGeneratedInvoiceId: null, createdBy: actorUid,
      });
      toast.success(tt('Şablon yaradıldı', 'Template created')); onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Repeat className="h-5 w-5 text-primary" /> {tt('Təkrarlanan faktura şablonu', 'Recurring invoice template')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2"><Label>{tt('Müştəri', 'Customer')}</Label>
              <Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder={tt('Seç', 'Select')} /></SelectTrigger>
                <SelectContent>{(customers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>{tt('Tezlik', 'Frequency')}</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="monthly">{tt('Aylıq', 'Monthly')}</SelectItem><SelectItem value="quarterly">{tt('Rüblük', 'Quarterly')}</SelectItem><SelectItem value="annually">{tt('İllik', 'Annually')}</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>{tt('İlk/növbəti tarix', 'First/next date')}</Label><Input type="date" value={nextRunDate} onChange={(e) => setNextRunDate(e.target.value)} /></div>
          </div>
          <LineItemsEditor lines={lines} onChange={setLines} currency={baseCurrency} />
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
