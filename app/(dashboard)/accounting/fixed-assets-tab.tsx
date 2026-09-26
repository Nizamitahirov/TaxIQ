'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Play } from 'lucide-react';
import { listFixedAssets, runDepreciation, monthlyDepreciation } from '@/lib/firebase/accounting';
import { ASSET_CATEGORY_MAP } from '@/lib/accounting/asset-categories';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ExportButton } from '@/components/shared/export-button';
import { FixedAssetDialog } from '@/components/shared/fixed-asset-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency } from '@/lib/utils/format';
import type { ChartAccount } from '@/types';

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
              <TableHead>{tt('Ad', 'Name')}</TableHead><TableHead>{tt('Kateqoriya', 'Category')}</TableHead><TableHead className="text-right">{tt('Dəyər', 'Cost')}</TableHead><TableHead>{tt('Metod', 'Method')}</TableHead>
              <TableHead className="text-right">{tt('Aylıq', 'Monthly')}</TableHead><TableHead className="text-right">{tt('Qalıq dəyər', 'Net book value')}</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{tt('Əsas vəsait yoxdur', 'No fixed assets')}</TableCell></TableRow>
              ) : (data ?? []).map((a) => {
                const cat = a.categoryKey ? ASSET_CATEGORY_MAP[a.categoryKey] : null;
                return (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.assetName}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{cat ? tt(cat.name.az, cat.name.en) : '—'}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(a.acquisitionCost)}</TableCell>
                  <TableCell className="text-xs">{a.depreciationMethod === 'straight_line' ? tt('Xətti', 'Straight-line') : `${tt('Azalan qalıq', 'Reducing balance')}${a.reducingBalanceRate ? ` ${a.reducingBalanceRate}%` : ''}`}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(monthlyDepreciation(a))}</TableCell>
                  <TableCell className="text-right tnum">{formatCurrency(a.netBookValue)}</TableCell>
                  <TableCell><Badge variant={a.status === 'active' ? 'success' : a.status === 'disposed' ? 'secondary' : 'warning'}>{a.status}</Badge></TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      {canManage && <FixedAssetDialog open={open} onOpenChange={setOpen} companyId={companyId} accounts={accounts} actorUid={actorUid}
        onSaved={() => qc.invalidateQueries({ queryKey: ['assets', companyId] })} />}
    </div>
  );
}
