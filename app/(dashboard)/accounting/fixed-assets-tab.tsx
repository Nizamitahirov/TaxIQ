'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Play } from 'lucide-react';
import { listFixedAssets, createFixedAsset, runDepreciation, monthlyDepreciation } from '@/lib/firebase/accounting';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ExportButton } from '@/components/shared/export-button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency } from '@/lib/utils/format';
import type { ChartAccount, FixedAsset } from '@/types';

export function FixedAssetsTab({ companyId, accounts, canManage, actorUid }: {
  companyId: string; accounts: ChartAccount[]; canManage: boolean; actorUid: string;
}) {
  const qc = useQueryClient();
  const tt = useTT();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['assets', companyId], queryFn: () => listFixedAssets(companyId) });

  const expenseAcct = accounts.find((a) => a.accountCode === '721');
  const accumAcct = accounts.find((a) => a.accountCode === '112');

  async function depreciate() {
    if (!expenseAcct || !accumAcct) { toast.error(tt('721 (İnzibati xərc) və 112 (yığılmış amortizasiya) hesabları lazımdır', '721 (Administrative expense) and 112 (accumulated depreciation) accounts are required')); return; }
    setBusy(true);
    try {
      const res = await runDepreciation(companyId, actorUid, expenseAcct.id, accumAcct.id);
      if (res.total === 0) toast.info(tt('Amortizasiya üçün aktiv aktiv yoxdur', 'No active assets to depreciate'));
      else toast.success(tt('Amortizasiya işləndi', 'Depreciation posted'), `${tt('Cəmi', 'Total')} ${formatCurrency(res.total)} (Dt 721 / Kt 112)`);
      qc.invalidateQueries({ queryKey: ['assets', companyId] });
      qc.invalidateQueries({ queryKey: ['journal', companyId] });
      qc.invalidateQueries({ queryKey: ['trial', companyId] });
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tt('IAS 16 — xətti / azalan qalıq amortizasiyası (08 §5)', 'IAS 16 — straight-line / reducing-balance depreciation (08 §5)')}</p>
        <div className="flex gap-2">
          <ExportButton filename="esas-vesaitler" rows={data ?? []}
            columns={[
              { header: tt('Ad', 'Name'), value: 'assetName' }, { header: tt('Dəyər', 'Cost'), value: 'acquisitionCost' },
              { header: tt('Metod', 'Method'), value: 'depreciationMethod' }, { header: tt('Yığılmış', 'Accumulated'), value: 'accumulatedDepreciation' },
              { header: tt('Qalıq dəyər', 'Net book value'), value: 'netBookValue' }, { header: 'Status', value: 'status' },
            ]} />
          {canManage && <>
            <Button size="sm" variant="outline" onClick={depreciate} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {tt('Amortizasiya işlə', 'Run depreciation')}</Button>
            <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Aktiv', 'Asset')}</Button>
          </>}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{tt('Ad', 'Name')}</TableHead><TableHead className="text-right">{tt('Dəyər', 'Cost')}</TableHead><TableHead>{tt('Metod', 'Method')}</TableHead>
              <TableHead className="text-right">{tt('Aylıq', 'Monthly')}</TableHead><TableHead className="text-right">{tt('Qalıq dəyər', 'Net book value')}</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{tt('Əsas vəsait yoxdur', 'No fixed assets')}</TableCell></TableRow>
              ) : (data ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.assetName}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(a.acquisitionCost)}</TableCell>
                  <TableCell className="text-xs">{a.depreciationMethod === 'straight_line' ? tt('Xətti', 'Straight-line') : tt('Azalan qalıq', 'Reducing balance')}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(monthlyDepreciation(a))}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(a.netBookValue)}</TableCell>
                  <TableCell><Badge variant={a.status === 'active' ? 'success' : a.status === 'disposed' ? 'secondary' : 'warning'}>{a.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {canManage && <NewAssetDialog open={open} onOpenChange={setOpen} companyId={companyId} accounts={accounts} actorUid={actorUid}
        onSaved={() => qc.invalidateQueries({ queryKey: ['assets', companyId] })} />}
    </div>
  );
}

function NewAssetDialog({ open, onOpenChange, companyId, accounts, actorUid, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; accounts: ChartAccount[]; actorUid: string; onSaved: () => void;
}) {
  const tt = useTT();
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [life, setLife] = useState('60');
  const [residual, setResidual] = useState('0');
  const [method, setMethod] = useState<FixedAsset['depreciationMethod']>('straight_line');
  const [rate, setRate] = useState('20');
  const [assetAccountId, setAssetAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const assetAccounts = accounts.filter((a) => a.accountType === 'asset' && a.isPostable);

  async function save() {
    if (!name.trim() || !cost) { toast.error(tt('Ad və dəyər tələb olunur', 'Name and cost are required')); return; }
    setSaving(true);
    try {
      await createFixedAsset({
        companyId, assetName: name.trim(), assetAccountId: assetAccountId || undefined,
        acquisitionDate: new Date().toISOString().slice(0, 10), acquisitionCost: Number(cost),
        depreciationMethod: method, usefulLifeMonths: Number(life) || 60, residualValue: Number(residual) || 0,
        reducingBalanceRate: method === 'reducing_balance' ? Number(rate) : null, departmentId: null, createdBy: actorUid,
      });
      toast.success(tt('Əsas vəsait əlavə edildi', 'Fixed asset added'));
      setName(''); setCost('');
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tt('Yeni əsas vəsait', 'New fixed asset')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>{tt('Ad', 'Name')}</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Dəyər', 'Cost')}</Label><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Qalıq dəyər', 'Residual value')}</Label><Input type="number" value={residual} onChange={(e) => setResidual(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>{tt('Amortizasiya metodu', 'Depreciation method')}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as FixedAsset['depreciationMethod'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="straight_line">{tt('Xətti (straight-line)', 'Straight-line')}</SelectItem><SelectItem value="reducing_balance">{tt('Azalan qalıq', 'Reducing balance')}</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Faydalı ömür (ay)', 'Useful life (months)')}</Label><Input type="number" value={life} onChange={(e) => setLife(e.target.value)} /></div>
            {method === 'reducing_balance' && <div className="space-y-2"><Label>{tt('İllik faiz (%)', 'Annual rate (%)')}</Label><Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} /></div>}
          </div>
          <div className="space-y-2">
            <Label>{tt('Aktiv hesabı (opsional)', 'Asset account (optional)')}</Label>
            <Select value={assetAccountId} onValueChange={setAssetAccountId}>
              <SelectTrigger><SelectValue placeholder={tt('Hesab seç', 'Select account')} /></SelectTrigger>
              <SelectContent className="max-h-60">{assetAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.accountCode} — {tt(a.accountName.az, a.accountName.en)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Əlavə et', 'Add')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
