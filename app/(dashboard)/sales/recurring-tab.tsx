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
import { LineItemsEditor, emptyLine, type DraftLine } from './line-items-editor';
import type { RecurringInvoiceTemplate } from '@/types';

const FREQ: Record<string, string> = { monthly: 'Aylıq', quarterly: 'Rüblük', annually: 'İllik' };

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function RecurringTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['recurring', companyId], queryFn: () => listRecurringTemplates(companyId) });
  function invalidate() { qc.invalidateQueries({ queryKey: ['recurring', companyId] }); qc.invalidateQueries({ queryKey: ['invoices', companyId] }); }

  async function generate() {
    setBusy(true);
    try { const n = await generateDueRecurringInvoices(companyId, actorUid); toast.success(n > 0 ? `${n} faktura yaradıldı` : 'Vaxtı çatan şablon yoxdur'); invalidate(); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }
  async function toggle(t: RecurringInvoiceTemplate) { await updateRecurringTemplate(t.id, { isActive: !t.isActive }); invalidate(); }
  async function remove(t: RecurringInvoiceTemplate) { await deleteRecurringTemplate(t.id); toast.success('Silindi'); invalidate(); }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Abunə xidmətləri üçün avtomatlaşdırılmış faktura şablonları (06 §4).</p>
        <div className="flex gap-2">
          <ExportButton filename="tekrarlanan-fakturalar" rows={data ?? []} columns={[
            { header: 'Müştəri', value: 'customerName' }, { header: 'Tezlik', value: (t) => FREQ[t.frequency] },
            { header: 'Növbəti', value: 'nextRunDate' }, { header: 'Aktiv', value: (t) => (t.isActive ? 'Bəli' : 'Xeyr') },
          ]} />
          <Button size="sm" variant="outline" onClick={generate} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Vaxtı çatanları yarat</Button>
          {canCreate && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Yeni şablon</Button>}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title="Təkrarlanan şablon yoxdur" description="Aylıq abunə fakturaları üçün şablon yaradın." />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Müştəri</TableHead><TableHead>Tezlik</TableHead><TableHead>Növbəti tarix</TableHead><TableHead className="text-right">Məbləğ</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((t) => {
                const total = computeTotals(t.lineItems).grandTotal;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.customerName}</TableCell>
                    <TableCell>{FREQ[t.frequency]}</TableCell>
                    <TableCell className="text-muted-foreground">{t.nextRunDate}</TableCell>
                    <TableCell className="text-right tnum">{formatCurrency(total, baseCurrency)}</TableCell>
                    <TableCell><Badge variant={t.isActive ? 'success' : 'secondary'}>{t.isActive ? 'aktiv' : 'passiv'}</Badge></TableCell>
                    <TableCell className="text-right">
                      {canCreate && <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggle(t)} title={t.isActive ? 'Söndür' : 'Aktivləşdir'}><Power className="h-4 w-4" /></Button>
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
  const [customerId, setCustomerId] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'quarterly' | 'annually'>('monthly');
  const [nextRunDate, setNextRunDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const { data: customers } = useQuery({ queryKey: ['customers', companyId], queryFn: () => listCustomers(companyId) });

  async function save() {
    const c = customers?.find((x) => x.id === customerId);
    if (!c) { toast.error('Müştəri seçin'); return; }
    const valid = lines.filter((l) => l.description && l.unitPrice > 0);
    if (valid.length === 0) { toast.error('Ən azı 1 sətir'); return; }
    setSaving(true);
    try {
      await createRecurringTemplate({
        companyId, customerId, customerName: c.name, lineItems: computeTotals(valid).lines,
        frequency, nextRunDate, endDate: null, isActive: true, lastGeneratedInvoiceId: null, createdBy: actorUid,
      });
      toast.success('Şablon yaradıldı'); onSaved(); onClose();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Repeat className="h-5 w-5 text-primary" /> Təkrarlanan faktura şablonu</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2"><Label>Müştəri</Label>
              <Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder="Seç" /></SelectTrigger>
                <SelectContent>{(customers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>Tezlik</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="monthly">Aylıq</SelectItem><SelectItem value="quarterly">Rüblük</SelectItem><SelectItem value="annually">İllik</SelectItem></SelectContent></Select>
            </div>
            <div className="space-y-2"><Label>İlk/növbəti tarix</Label><Input type="date" value={nextRunDate} onChange={(e) => setNextRunDate(e.target.value)} /></div>
          </div>
          <LineItemsEditor lines={lines} onChange={setLines} currency={baseCurrency} />
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Yarat</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
