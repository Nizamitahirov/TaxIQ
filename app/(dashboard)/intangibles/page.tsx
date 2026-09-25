'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, PlayCircle, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listIntangibleAssets, createIntangibleAsset, deleteIntangibleAsset, monthlyAmortization, runAmortization } from '@/lib/firebase/intangibles';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
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
import type { IntangibleType } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;
const TYPE_LABEL: Record<IntangibleType, [string, string]> = {
  software: ['Proqram təminatı', 'Software'], license: ['Lisenziya', 'License'], patent: ['Patent', 'Patent'],
  trademark: ['Əmtəə nişanı', 'Trademark'], goodwill: ['Qudvil', 'Goodwill'], development: ['İşləmə xərcləri', 'Development'], other: ['Digər', 'Other'],
};

export default function IntangiblesPage() {
  const tt = useTT();
  const qc = useQueryClient();
  const { active, isSuperAdmin, can, profile } = useAuth();
  const companyId = active?.companyId;
  const cur = active?.company.baseCurrency ?? 'AZN';
  const canView = isSuperAdmin || can('accounting.coa.view') || can('reports.view');
  const canEdit = isSuperAdmin || can('accounting.journal.create');
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['intangibles', companyId], queryFn: () => listIntangibleAssets(companyId!), enabled: canView && !!companyId });

  const totals = useMemo(() => {
    const rows = data ?? [];
    return {
      cost: round2(rows.reduce((s, a) => s + a.acquisitionCost, 0)),
      accum: round2(rows.reduce((s, a) => s + a.accumulatedAmortization, 0)),
      nbv: round2(rows.reduce((s, a) => s + a.netBookValue, 0)),
      monthly: round2(rows.reduce((s, a) => s + monthlyAmortization(a), 0)),
    };
  }, [data]);

  async function run() {
    setRunning(true);
    try {
      const { total, entryId } = await runAmortization(companyId!, profile?.uid ?? '');
      qc.invalidateQueries({ queryKey: ['intangibles', companyId] });
      if (total > 0) toast.success(tt('Amortizasiya hesablandı', 'Amortization posted'), `${formatCurrency(total, cur)}${entryId ? '' : ''}`);
      else toast.info(tt('Amortizasiya yoxdur', 'Nothing to amortize'));
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setRunning(false); }
  }

  if (!companyId) return <div><PageHeader title={tt('Qeyri-maddi aktivlər', 'Intangible assets')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('Qeyri-maddi aktivlər', 'Intangible assets')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader
        title={tt('Qeyri-maddi aktivlər', 'Intangible assets')}
        subtitle={tt('Proqram, lisenziya, patent və s. — amortizasiya (IAS 38)', 'Software, licenses, patents — amortization (IAS 38)')}
        action={canEdit && <div className="flex gap-2">
          <Button variant="outline" onClick={run} disabled={running}>{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />} {tt('Aylıq amortizasiya', 'Run amortization')}</Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni aktiv', 'New asset')}</Button>
        </div>}
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-4">
        <Mini label={tt('Ümumi dəyər', 'Total cost')} value={formatCurrency(totals.cost, cur)} />
        <Mini label={tt('Yığılmış amortizasiya', 'Accumulated')} value={formatCurrency(totals.accum, cur)} />
        <Mini label={tt('Xalis qalıq (NBV)', 'Net book value')} value={formatCurrency(totals.nbv, cur)} primary />
        <Mini label={tt('Aylıq amortizasiya', 'Monthly')} value={formatCurrency(totals.monthly, cur)} />
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : !data || data.length === 0 ? <EmptyState title={tt('Qeyri-maddi aktiv yoxdur', 'No intangible assets')} action={canEdit && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni aktiv', 'New asset')}</Button>} />
        : <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto"><Table>
            <TableHeader><TableRow><TableHead>{tt('Ad', 'Name')}</TableHead><TableHead>{tt('Növ', 'Type')}</TableHead><TableHead>{tt('Alınma', 'Acquired')}</TableHead><TableHead className="text-right">{tt('Dəyər', 'Cost')}</TableHead><TableHead className="text-right">{tt('Aylıq', 'Monthly')}</TableHead><TableHead className="text-right">{tt('Yığılmış', 'Accum.')}</TableHead><TableHead className="text-right">NBV</TableHead><TableHead>{tt('Status', 'Status')}</TableHead>{canEdit && <TableHead className="w-12" />}</TableRow></TableHeader>
            <TableBody>{data.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.assetName}</TableCell>
                <TableCell className="text-muted-foreground">{tt(TYPE_LABEL[a.assetType][0], TYPE_LABEL[a.assetType][1])}</TableCell>
                <TableCell className="text-muted-foreground">{a.acquisitionDate}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(a.acquisitionCost, cur)}</TableCell>
                <TableCell className="text-right tnum">{a.indefiniteLife ? tt('—', '—') : formatCurrency(monthlyAmortization(a), cur)}</TableCell>
                <TableCell className="text-right tnum text-muted-foreground">{formatCurrency(a.accumulatedAmortization, cur)}</TableCell>
                <TableCell className="text-right tnum font-semibold">{formatCurrency(a.netBookValue, cur)}</TableCell>
                <TableCell><Badge variant={a.status === 'active' ? 'default' : 'secondary'}>{a.status === 'active' ? tt('Aktiv', 'Active') : a.status === 'fully_amortized' ? tt('Tam amortizasiya', 'Fully amortized') : tt('Silinmiş', 'Disposed')}</Badge></TableCell>
                {canEdit && <TableCell><Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => { if (confirm(tt('Silinsin?', 'Delete?'))) deleteIntangibleAsset(a, profile?.uid ?? '').then(() => qc.invalidateQueries({ queryKey: ['intangibles', companyId] })); }}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>}
              </TableRow>))}</TableBody></Table></div></CardContent></Card>}

      {open && <CreateDialog companyId={companyId} actorUid={profile?.uid ?? ''} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); qc.invalidateQueries({ queryKey: ['intangibles', companyId] }); }} />}
    </div>
  );
}

function Mini({ label, value, primary }: { label: string; value: string; primary?: boolean }) {
  return <Card className="rounded-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-lg font-bold ${primary ? 'text-primary' : ''}`}>{value}</p></CardContent></Card>;
}

function CreateDialog({ companyId, actorUid, onClose, onSaved }: { companyId: string; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [f, setF] = useState({
    assetName: '', assetType: 'software' as IntangibleType, acquisitionDate: new Date().toISOString().slice(0, 10),
    acquisitionCost: '', usefulLifeMonths: '36', indefiniteLife: false,
  });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p }));

  async function save() {
    if (!f.assetName.trim() || !(Number(f.acquisitionCost) > 0)) { toast.error(tt('Ad və dəyər lazımdır', 'Name and cost required')); return; }
    setSaving(true);
    try {
      await createIntangibleAsset({
        companyId, assetName: f.assetName.trim(), assetType: f.assetType, acquisitionDate: f.acquisitionDate,
        acquisitionCost: Number(f.acquisitionCost), indefiniteLife: f.indefiniteLife,
        usefulLifeMonths: f.indefiniteLife ? 0 : (Number(f.usefulLifeMonths) || 0), departmentId: null, createdBy: actorUid,
      });
      toast.success(tt('Aktiv əlavə edildi', 'Asset added'));
      onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{tt('Yeni qeyri-maddi aktiv', 'New intangible asset')}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1"><Label>{tt('Ad *', 'Name *')}</Label><Input value={f.assetName} onChange={(e) => set({ assetName: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>{tt('Növ', 'Type')}</Label>
            <Select value={f.assetType} onValueChange={(v) => set({ assetType: v as IntangibleType, indefiniteLife: v === 'goodwill' })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{tt(v[0], v[1])}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>{tt('Alınma tarixi', 'Acquisition date')}</Label><Input type="date" value={f.acquisitionDate} onChange={(e) => set({ acquisitionDate: e.target.value })} /></div>
          <div className="space-y-1"><Label>{tt('Dəyər *', 'Cost *')}</Label><Input type="number" value={f.acquisitionCost} onChange={(e) => set({ acquisitionCost: e.target.value })} /></div>
          <div className="space-y-1"><Label>{tt('Faydalı müddət (ay)', 'Useful life (months)')}</Label><Input type="number" value={f.usefulLifeMonths} onChange={(e) => set({ usefulLifeMonths: e.target.value })} disabled={f.indefiniteLife} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.indefiniteLife} onChange={(e) => set({ indefiniteLife: e.target.checked })} /> {tt('Qeyri-müəyyən faydalı müddət (amortizasiya olunmur)', 'Indefinite useful life (not amortized)')}</label>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {tt('Əlavə et', 'Add')}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}
