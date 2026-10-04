'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Building, Map } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import {
  listPropertyAssets, createPropertyAsset, deletePropertyAsset, propertyRows,
  listLandPlots, createLandPlot, deleteLandPlot, landRows,
} from '@/lib/firebase/property-tax';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils/format';

export default function PropertyTaxPage() {
  const tt = useTT();
  const { active, isSuperAdmin, can } = useAuth();
  const companyId = active?.companyId;
  const cur = active?.company.baseCurrency ?? 'AZN';
  const canView = isSuperAdmin || can('accounting.coa.view') || can('reports.view');
  const canEdit = isSuperAdmin || can('accounting.journal.post');

  if (!companyId) return <div><PageHeader title={tt('Əmlak və torpaq vergisi', 'Property & land tax')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('Əmlak və torpaq vergisi', 'Property & land tax')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader title={tt('Əmlak və torpaq vergisi', 'Property & land tax')} subtitle={tt('Əmlak reyestri (orta illik dəyər × 1%) və torpaq reyestri (sahə × tarif) — Vergi Məcəlləsi m.197-210', 'Property register (avg value × 1%) and land register (area × tariff)')} />
      <Tabs defaultValue="property">
        <TabsList><TabsTrigger value="property"><Building className="mr-1.5 h-4 w-4" />{tt('Əmlak', 'Property')}</TabsTrigger><TabsTrigger value="land"><Map className="mr-1.5 h-4 w-4" />{tt('Torpaq', 'Land')}</TabsTrigger></TabsList>
        <TabsContent value="property"><PropertyReg companyId={companyId} cur={cur} canEdit={canEdit} actorUid={active?.company.createdBy ?? ''} /></TabsContent>
        <TabsContent value="land"><LandReg companyId={companyId} cur={cur} canEdit={canEdit} actorUid={active?.company.createdBy ?? ''} /></TabsContent>
      </Tabs>
    </div>
  );
}

function PropertyReg({ companyId, cur, canEdit, actorUid }: { companyId: string; cur: string; canEdit: boolean; actorUid: string }) {
  const tt = useTT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['propertyTaxAssets', companyId], queryFn: () => listPropertyAssets(companyId) });
  const { rows, totalTax, totalAdvance } = useMemo(() => propertyRows(data ?? []), [data]);
  const refresh = () => qc.invalidateQueries({ queryKey: ['propertyTaxAssets', companyId] });

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-6 text-sm"><span>{tt('İllik vergi', 'Annual tax')}: <b className="tnum text-primary">{formatCurrency(totalTax, cur)}</b></span><span className="text-muted-foreground">{tt('Rüblük avans', 'Quarterly advance')}: <b className="tnum">{formatCurrency(totalAdvance, cur)}</b></span></div>
        {canEdit && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Əmlak əlavə et', 'Add property')}</Button>}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : rows.length === 0 ? <EmptyState title={tt('Əmlak yoxdur', 'No property')} />
        : <Card className="rounded-card"><CardContent className="overflow-x-auto p-0"><Table>
            <TableHeader><TableRow><TableHead>{tt('Ad', 'Name')}</TableHead><TableHead className="text-right">{tt('İl əvvəli', 'Opening')}</TableHead><TableHead className="text-right">{tt('İl sonu', 'Closing')}</TableHead><TableHead className="text-right">{tt('Orta dəyər', 'Avg value')}</TableHead><TableHead className="text-right">{tt('Vergi (1%)', 'Tax (1%)')}</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>{rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(r.openingResidual, cur)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(r.closingResidual, cur)}</TableCell>
                <TableCell className="text-right tnum">{formatCurrency(r.averageValue, cur)}</TableCell>
                <TableCell className="text-right tnum font-medium">{formatCurrency(r.tax, cur)}</TableCell>
                <TableCell>{canEdit && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => { if (confirm(tt('Silinsin?', 'Delete?'))) deletePropertyAsset(r, actorUid).then(refresh); }}><Trash2 className="h-3.5 w-3.5" /></Button>}</TableCell>
              </TableRow>))}</TableBody>
          </Table></CardContent></Card>}
      {open && <PropertyDialog companyId={companyId} actorUid={actorUid} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refresh(); }} />}
    </div>
  );
}

function PropertyDialog({ companyId, actorUid, onClose, onSaved }: { companyId: string; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [f, setF] = useState({ name: '', opening: '', closing: '' });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!f.name.trim()) { toast.error(tt('Ad lazımdır', 'Name required')); return; }
    setSaving(true);
    try {
      await createPropertyAsset({ companyId, name: f.name.trim(), openingResidual: Number(f.opening) || 0, closingResidual: Number(f.closing) || 0, year: new Date().getFullYear(), createdBy: actorUid });
      toast.success(tt('Əlavə edildi', 'Added')); onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{tt('Yeni əmlak', 'New property')}</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div className="space-y-1"><Label>{tt('Ad', 'Name')}</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>{tt('İl əvvəli qalıq', 'Opening residual')}</Label><Input type="number" value={f.opening} onChange={(e) => setF({ ...f, opening: e.target.value })} /></div>
          <div className="space-y-1"><Label>{tt('İl sonu qalıq', 'Closing residual')}</Label><Input type="number" value={f.closing} onChange={(e) => setF({ ...f, closing: e.target.value })} /></div>
        </div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Əlavə et', 'Add')}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}

function LandReg({ companyId, cur, canEdit, actorUid }: { companyId: string; cur: string; canEdit: boolean; actorUid: string }) {
  const tt = useTT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['landPlots', companyId], queryFn: () => listLandPlots(companyId) });
  const { rows, totalTax } = useMemo(() => landRows(data ?? []), [data]);
  const refresh = () => qc.invalidateQueries({ queryKey: ['landPlots', companyId] });

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm">{tt('İllik torpaq vergisi', 'Annual land tax')}: <b className="tnum text-primary">{formatCurrency(totalTax, cur)}</b></span>
        {canEdit && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Torpaq əlavə et', 'Add plot')}</Button>}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : rows.length === 0 ? <EmptyState title={tt('Torpaq sahəsi yoxdur', 'No land plots')} />
        : <Card className="rounded-card"><CardContent className="overflow-x-auto p-0"><Table>
            <TableHeader><TableRow><TableHead>{tt('Yer', 'Location')}</TableHead><TableHead className="text-right">{tt('Sahə', 'Area')}</TableHead><TableHead className="text-right">{tt('Tarif', 'Tariff')}</TableHead><TableHead className="text-right">{tt('Vergi', 'Tax')}</TableHead><TableHead className="w-10" /></TableRow></TableHeader>
            <TableBody>{rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.location}</TableCell>
                <TableCell className="text-right tnum">{r.areaUnits} {r.unit ?? 'm²'}</TableCell>
                <TableCell className="text-right tnum">{r.tariffPerUnit}</TableCell>
                <TableCell className="text-right tnum font-medium">{formatCurrency(r.tax, cur)}</TableCell>
                <TableCell>{canEdit && <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => { if (confirm(tt('Silinsin?', 'Delete?'))) deleteLandPlot(r, actorUid).then(refresh); }}><Trash2 className="h-3.5 w-3.5" /></Button>}</TableCell>
              </TableRow>))}</TableBody>
          </Table></CardContent></Card>}
      {open && <LandDialog companyId={companyId} actorUid={actorUid} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); refresh(); }} />}
    </div>
  );
}

function LandDialog({ companyId, actorUid, onClose, onSaved }: { companyId: string; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [f, setF] = useState({ location: '', area: '', tariff: '' });
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!f.location.trim()) { toast.error(tt('Yer lazımdır', 'Location required')); return; }
    setSaving(true);
    try {
      await createLandPlot({ companyId, location: f.location.trim(), areaUnits: Number(f.area) || 0, tariffPerUnit: Number(f.tariff) || 0, year: new Date().getFullYear(), createdBy: actorUid });
      toast.success(tt('Əlavə edildi', 'Added')); onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}><DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{tt('Yeni torpaq sahəsi', 'New land plot')}</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div className="space-y-1"><Label>{tt('Yer', 'Location')}</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>{tt('Sahə (m²)', 'Area (m²)')}</Label><Input type="number" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} /></div>
          <div className="space-y-1"><Label>{tt('Zona tarifi', 'Zone tariff')}</Label><Input type="number" value={f.tariff} onChange={(e) => setF({ ...f, tariff: e.target.value })} /></div>
        </div>
      </div>
      <DialogFooter><Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Əlavə et', 'Add')}</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}
