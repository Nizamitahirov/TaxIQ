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
import { formatCurrency } from '@/lib/utils/format';
import type { ChartAccount, FixedAsset } from '@/types';

export function FixedAssetsTab({ companyId, accounts, canManage, actorUid }: {
  companyId: string; accounts: ChartAccount[]; canManage: boolean; actorUid: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['assets', companyId], queryFn: () => listFixedAssets(companyId) });

  const expenseAcct = accounts.find((a) => a.accountCode === '721');
  const accumAcct = accounts.find((a) => a.accountCode === '112');

  async function depreciate() {
    if (!expenseAcct || !accumAcct) { toast.error('721 (İnzibati xərc) və 112 (yığılmış amortizasiya) hesabları lazımdır'); return; }
    setBusy(true);
    try {
      const res = await runDepreciation(companyId, actorUid, expenseAcct.id, accumAcct.id);
      if (res.total === 0) toast.info('Amortizasiya üçün aktiv aktiv yoxdur');
      else toast.success('Amortizasiya işləndi', `Cəmi ${formatCurrency(res.total)} (Dt 721 / Kt 112)`);
      qc.invalidateQueries({ queryKey: ['assets', companyId] });
      qc.invalidateQueries({ queryKey: ['journal', companyId] });
      qc.invalidateQueries({ queryKey: ['trial', companyId] });
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">IAS 16 — xətti / azalan qalıq amortizasiyası (08 §5)</p>
        <div className="flex gap-2">
          <ExportButton filename="esas-vesaitler" rows={data ?? []}
            columns={[
              { header: 'Ad', value: 'assetName' }, { header: 'Dəyər', value: 'acquisitionCost' },
              { header: 'Metod', value: 'depreciationMethod' }, { header: 'Yığılmış', value: 'accumulatedDepreciation' },
              { header: 'Qalıq dəyər', value: 'netBookValue' }, { header: 'Status', value: 'status' },
            ]} />
          {canManage && <>
            <Button size="sm" variant="outline" onClick={depreciate} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Amortizasiya işlə</Button>
            <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Aktiv</Button>
          </>}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Ad</TableHead><TableHead className="text-right">Dəyər</TableHead><TableHead>Metod</TableHead>
              <TableHead className="text-right">Aylıq</TableHead><TableHead className="text-right">Qalıq dəyər</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Əsas vəsait yoxdur</TableCell></TableRow>
              ) : (data ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.assetName}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(a.acquisitionCost)}</TableCell>
                  <TableCell className="text-xs">{a.depreciationMethod === 'straight_line' ? 'Xətti' : 'Azalan qalıq'}</TableCell>
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
    if (!name.trim() || !cost) { toast.error('Ad və dəyər tələb olunur'); return; }
    setSaving(true);
    try {
      await createFixedAsset({
        companyId, assetName: name.trim(), assetAccountId: assetAccountId || undefined,
        acquisitionDate: new Date().toISOString().slice(0, 10), acquisitionCost: Number(cost),
        depreciationMethod: method, usefulLifeMonths: Number(life) || 60, residualValue: Number(residual) || 0,
        reducingBalanceRate: method === 'reducing_balance' ? Number(rate) : null, departmentId: null, createdBy: actorUid,
      });
      toast.success('Əsas vəsait əlavə edildi');
      setName(''); setCost('');
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Yeni əsas vəsait</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Ad</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Dəyər</Label><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
            <div className="space-y-2"><Label>Qalıq dəyər</Label><Input type="number" value={residual} onChange={(e) => setResidual(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>Amortizasiya metodu</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as FixedAsset['depreciationMethod'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="straight_line">Xətti (straight-line)</SelectItem><SelectItem value="reducing_balance">Azalan qalıq</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Faydalı ömür (ay)</Label><Input type="number" value={life} onChange={(e) => setLife(e.target.value)} /></div>
            {method === 'reducing_balance' && <div className="space-y-2"><Label>İllik faiz (%)</Label><Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} /></div>}
          </div>
          <div className="space-y-2">
            <Label>Aktiv hesabı (opsional)</Label>
            <Select value={assetAccountId} onValueChange={setAssetAccountId}>
              <SelectTrigger><SelectValue placeholder="Hesab seç" /></SelectTrigger>
              <SelectContent className="max-h-60">{assetAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.accountCode} — {a.accountName.az}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Əlavə et</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
