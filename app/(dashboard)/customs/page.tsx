'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Ship, Check, X } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listCustomsDeclarations, createCustomsDeclaration, setCustomsStatus, deleteCustomsDeclaration, nextDeclarationNumber } from '@/lib/firebase/customs';
import { computeCustoms, transactionCustomsValue, CUSTOMS_REGIMES } from '@/lib/customs/engine';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils/format';
import type { CustomsDeclaration, CustomsDeclStatus, CustomsLine, CustomsRegime } from '@/types';

const STATUS: Record<CustomsDeclStatus, [string, string, string]> = {
  draft: ['Qaralama', 'Draft', 'secondary'], submitted: ['Təqdim edilib', 'Submitted', 'warning'],
  cleared: ['Buraxılıb', 'Cleared', 'success'], cancelled: ['Ləğv', 'Cancelled', 'destructive'],
};
const regimeLabel = (r: CustomsRegime, az: boolean) => { const f = CUSTOMS_REGIMES.find((x) => x.value === r); return f ? (az ? f.az : f.en) : r; };

export default function CustomsPage() {
  const tt = useTT();
  const { active, isSuperAdmin, can, profile } = useAuth();
  const companyId = active?.companyId;
  const cur = active?.company.baseCurrency ?? 'AZN';
  const canView = isSuperAdmin || can('warehouse.view') || can('accounting.coa.view');
  const canEdit = isSuperAdmin || can('warehouse.edit') || can('accounting.journal.post');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['customsDeclarations', companyId], queryFn: () => listCustomsDeclarations(companyId!), enabled: canView && !!companyId });
  const refresh = () => qc.invalidateQueries({ queryKey: ['customsDeclarations', companyId] });

  if (!companyId) return <div><PageHeader title={tt('Gömrük', 'Customs')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('Gömrük', 'Customs')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader title={tt('Gömrük', 'Customs')} subtitle={tt('İdxal/ixrac bəyannamələri, gömrük dəyəri və ödənişlər (rüsum + idxal ƏDV + aksiz)', 'Import/export declarations, customs value and payments (duty + import VAT + excise)')}
        action={canEdit ? <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni bəyannamə', 'New declaration')}</Button> : undefined} />

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : (data ?? []).length === 0 ? <EmptyState title={tt('Bəyannamə yoxdur', 'No declarations')} description={tt('Yeni gömrük bəyannaməsi yaradın', 'Create a customs declaration')} />
        : (
        <>
          <div className="mb-3 flex justify-end">
            <ExportButton filename="gomruk-beyannameleri" rows={data ?? []} columns={[
              { header: tt('Nömrə', 'Number'), value: 'declarationNumber' }, { header: tt('Rejim', 'Regime'), value: (d) => regimeLabel(d.regime, true) },
              { header: tt('Tarix', 'Date'), value: 'declarationDate' }, { header: tt('Gömrük dəyəri', 'Customs value'), value: 'totalCustomsValue' },
              { header: tt('Rüsum', 'Duty'), value: 'totalDuty' }, { header: tt('Aksiz', 'Excise'), value: 'totalExcise' }, { header: tt('İdxal ƏDV', 'Import VAT'), value: 'totalImportVat' },
              { header: tt('Ödəniləcək', 'Payable'), value: 'totalPayable' }, { header: 'Status', value: 'status' },
            ]} />
          </div>
          <Card className="rounded-card"><CardContent className="overflow-x-auto p-0"><Table>
            <TableHeader><TableRow>
              <TableHead>{tt('Nömrə', 'Number')}</TableHead><TableHead>{tt('Rejim', 'Regime')}</TableHead><TableHead>{tt('Tarix', 'Date')}</TableHead>
              <TableHead className="text-right">{tt('Gömrük dəyəri', 'Customs value')}</TableHead><TableHead className="text-right">{tt('Rüsum', 'Duty')}</TableHead>
              <TableHead className="text-right">{tt('Aksiz', 'Excise')}</TableHead><TableHead className="text-right">{tt('İdxal ƏDV', 'Import VAT')}</TableHead>
              <TableHead className="text-right">{tt('Ödəniləcək', 'Payable')}</TableHead><TableHead>Status</TableHead><TableHead className="w-24" />
            </TableRow></TableHeader>
            <TableBody>{(data ?? []).map((d) => (
              <TableRow key={d.id}>
                <TableCell className="font-mono text-xs">{d.declarationNumber}</TableCell>
                <TableCell>{regimeLabel(d.regime, true)}</TableCell>
                <TableCell className="text-muted-foreground">{d.declarationDate}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(d.totalCustomsValue, cur)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(d.totalDuty, cur)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(d.totalExcise, cur)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(d.totalImportVat, cur)}</TableCell>
                <TableCell className="text-right tnum font-semibold text-primary">{formatCurrency(d.totalPayable, cur)}</TableCell>
                <TableCell><Badge variant={STATUS[d.status][2] as 'secondary'}>{tt(STATUS[d.status][0], STATUS[d.status][1])}</Badge></TableCell>
                <TableCell className="text-right">
                  {canEdit && d.status === 'draft' && <Button variant="ghost" size="icon" className="h-7 w-7 text-success" title={tt('Təqdim et', 'Submit')} onClick={() => setCustomsStatus(d, 'submitted', profile?.uid ?? '').then(refresh)}><Check className="h-3.5 w-3.5" /></Button>}
                  {canEdit && d.status === 'submitted' && <Button variant="ghost" size="sm" onClick={() => setCustomsStatus(d, 'cleared', profile?.uid ?? '').then(refresh)}>{tt('Buraxılış', 'Clear')}</Button>}
                  {canEdit && d.status !== 'cleared' && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => { if (confirm(tt('Silinsin?', 'Delete?'))) deleteCustomsDeclaration(d, profile?.uid ?? '').then(refresh); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
                </TableCell>
              </TableRow>))}</TableBody>
          </Table></CardContent></Card>
        </>
      )}
      {open && <DeclDialog companyId={companyId} cur={cur} actorUid={profile?.uid ?? ''} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refresh(); }} />}
    </div>
  );
}

type LineForm = { description: string; hsCode: string; quantity: string; goods: string; freight: string; insurance: string; dutyRate: string; exciseRate: string; vat: boolean };
const emptyLine: LineForm = { description: '', hsCode: '', quantity: '1', goods: '', freight: '0', insurance: '0', dutyRate: '0', exciseRate: '0', vat: true };

function DeclDialog({ companyId, cur, actorUid, onClose, onSaved }: { companyId: string; cur: string; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [regime, setRegime] = useState<CustomsRegime>('import');
  const [counterparty, setCounterparty] = useState('');
  const [origin, setOrigin] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [fee, setFee] = useState('0');
  const [lines, setLines] = useState<LineForm[]>([{ ...emptyLine }]);
  const [saving, setSaving] = useState(false);

  const customsLines: CustomsLine[] = useMemo(() => lines.map((l) => ({
    description: l.description.trim() || '—', hsCode: l.hsCode.trim() || null, quantity: Number(l.quantity) || 1,
    customsValue: transactionCustomsValue(Number(l.goods) || 0, Number(l.freight) || 0, Number(l.insurance) || 0),
    dutyRate: Number(l.dutyRate) || 0, exciseRate: Number(l.exciseRate) || 0, vatApplicable: l.vat,
  })), [lines]);
  const totals = useMemo(() => computeCustoms(customsLines, regime, Number(fee) || 0), [customsLines, regime, fee]);

  const setLine = (i: number, p: Partial<LineForm>) => setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, ...p } : l));

  async function save() {
    if (customsLines.every((l) => l.customsValue === 0)) { toast.error(tt('Ən azı bir sətir dəyəri daxil edin', 'Enter at least one line value')); return; }
    setSaving(true);
    try {
      const declarationNumber = await nextDeclarationNumber(companyId);
      await createCustomsDeclaration({ companyId, declarationNumber, regime, declarationDate: date, counterparty: counterparty.trim() || null, originCountry: origin.trim() || null, currency: cur, lines: customsLines, customsFee: Number(fee) || 0, createdBy: actorUid });
      toast.success(tt('Bəyannamə yaradıldı', 'Declaration created'), declarationNumber); onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><Ship className="h-4 w-4" /> {tt('Yeni gömrük bəyannaməsi', 'New customs declaration')}</DialogTitle></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1"><Label>{tt('Rejim', 'Regime')}</Label>
          <Select value={regime} onValueChange={(v) => setRegime(v as CustomsRegime)}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CUSTOMS_REGIMES.map((r) => <SelectItem key={r.value} value={r.value}>{tt(r.az, r.en)}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1"><Label>{tt('Tarix', 'Date')}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="space-y-1"><Label>{tt('Qarşı tərəf', 'Counterparty')}</Label><Input value={counterparty} onChange={(e) => setCounterparty(e.target.value)} /></div>
        <div className="space-y-1"><Label>{tt('Mənşə ölkə', 'Origin country')}</Label><Input value={origin} onChange={(e) => setOrigin(e.target.value)} /></div>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between"><Label>{tt('Mallar', 'Goods')}</Label><Button variant="outline" size="sm" onClick={() => setLines((ls) => [...ls, { ...emptyLine }])}><Plus className="h-3.5 w-3.5" /> {tt('Sətir', 'Line')}</Button></div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 items-end gap-1.5 rounded-lg border p-2">
            <div className="col-span-3 space-y-0.5"><Label className="text-[10px]">{tt('Təsvir', 'Description')}</Label><Input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} className="h-8" /></div>
            <div className="col-span-2 space-y-0.5"><Label className="text-[10px]">HS/ETN</Label><Input value={l.hsCode} onChange={(e) => setLine(i, { hsCode: e.target.value })} className="h-8" /></div>
            <div className="col-span-2 space-y-0.5"><Label className="text-[10px]">{tt('Mal dəyəri', 'Goods value')}</Label><Input type="number" value={l.goods} onChange={(e) => setLine(i, { goods: e.target.value })} className="h-8" /></div>
            <div className="col-span-1 space-y-0.5"><Label className="text-[10px]">{tt('Fraxt', 'Freight')}</Label><Input type="number" value={l.freight} onChange={(e) => setLine(i, { freight: e.target.value })} className="h-8" /></div>
            <div className="col-span-1 space-y-0.5"><Label className="text-[10px]">{tt('Rüsum%', 'Duty%')}</Label><Input type="number" value={l.dutyRate} onChange={(e) => setLine(i, { dutyRate: e.target.value })} className="h-8" /></div>
            <div className="col-span-1 space-y-0.5"><Label className="text-[10px]">{tt('Aksiz%', 'Excise%')}</Label><Input type="number" value={l.exciseRate} onChange={(e) => setLine(i, { exciseRate: e.target.value })} className="h-8" /></div>
            <div className="col-span-1 flex items-center justify-center pb-1.5"><input type="checkbox" title="ƏDV" checked={l.vat} onChange={(e) => setLine(i, { vat: e.target.checked })} /></div>
            <div className="col-span-1 flex items-center justify-end pb-1">{lines.length > 1 && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}><X className="h-3.5 w-3.5" /></Button>}</div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="space-y-1"><Label>{tt('Gömrük yığımı', 'Customs fee')}</Label><Input type="number" value={fee} onChange={(e) => setFee(e.target.value)} className="w-32" /></div>
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="flex justify-between gap-8"><span className="text-muted-foreground">{tt('Gömrük dəyəri', 'Customs value')}</span><span className="tnum">{formatCurrency(totals.totalCustomsValue, cur)}</span></div>
          <div className="flex justify-between gap-8"><span className="text-muted-foreground">{tt('Rüsum', 'Duty')}</span><span className="tnum">{formatCurrency(totals.totalDuty, cur)}</span></div>
          <div className="flex justify-between gap-8"><span className="text-muted-foreground">{tt('Aksiz', 'Excise')}</span><span className="tnum">{formatCurrency(totals.totalExcise, cur)}</span></div>
          <div className="flex justify-between gap-8"><span className="text-muted-foreground">{tt('İdxal ƏDV (18%)', 'Import VAT (18%)')}</span><span className="tnum">{formatCurrency(totals.totalImportVat, cur)}</span></div>
          <div className="mt-1 flex justify-between gap-8 border-t pt-1 font-semibold"><span>{tt('Ödəniləcək', 'Payable')}</span><span className="tnum text-primary">{formatCurrency(totals.totalPayable, cur)}</span></div>
        </div>
      </div>

      <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ship className="h-4 w-4" />} {tt('Yarat', 'Create')}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}
