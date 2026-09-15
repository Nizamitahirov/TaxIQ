'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Lock, Unlock, Plus } from 'lucide-react';
import { listPeriods, ensurePeriod, closePeriod, reopenPeriod } from '@/lib/firebase/accounting';
import { ExportButton } from '@/components/shared/export-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import type { AccountingPeriod } from '@/types';

export function PeriodsTab({ companyId, canManage, actorUid }: { companyId: string; canManage: boolean; actorUid: string }) {
  const qc = useQueryClient();
  const tt = useTT();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['periods', companyId], queryFn: () => listPeriods(companyId) });

  function refresh() { qc.invalidateQueries({ queryKey: ['periods', companyId] }); }

  async function addPeriod() {
    setBusy(true);
    try { await ensurePeriod(companyId, `${month}-01`); toast.success(tt('Dövr yaradıldı', 'Period created')); refresh(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }
  async function toggle(p: AccountingPeriod) {
    setBusy(true);
    try {
      if (p.status === 'open') { await closePeriod(p.id, actorUid); toast.success(tt('Dövr bağlandı', 'Period closed')); }
      else {
        const reason = window.prompt(tt('Dövrü yenidən açmaq üçün səbəb (audit-ə yazılır):', 'Reason to reopen the period (recorded in the audit log):')) ?? '';
        if (!reason.trim()) { setBusy(false); return; }
        await reopenPeriod(p.id, actorUid, reason.trim()); toast.success(tt('Dövr yenidən açıldı', 'Period reopened'));
      }
      refresh();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tt('Bağlı dövrə yazı aparıla bilməz; yenidən açma səbəb + audit tələb edir (08 §4)', 'No entries can be posted to a closed period; reopening requires a reason + audit (08 §4)')}</p>
        <div className="flex items-end gap-2">
          <ExportButton filename="muhasibat-dovrleri" rows={data ?? []} columns={[
            { header: tt('Dövr', 'Period'), value: (p) => `${p.fiscalYear}-${String(p.periodNumber).padStart(2, '0')}` },
            { header: tt('Başlanğıc', 'Start'), value: 'periodStart' }, { header: tt('Son', 'End'), value: 'periodEnd' },
            { header: 'Status', value: (p) => (p.status === 'open' ? tt('açıq', 'open') : tt('bağlı', 'closed')) },
          ]} />
          {canManage && (
            <>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
              <Button size="sm" onClick={addPeriod} disabled={busy}><Plus className="h-4 w-4" /> {tt('Dövr aç', 'Open period')}</Button>
            </>
          )}
        </div>
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{tt('Dövr', 'Period')}</TableHead><TableHead>{tt('Başlanğıc', 'Start')}</TableHead><TableHead>{tt('Son', 'End')}</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">{tt('Dövr yoxdur', 'No periods')}</TableCell></TableRow>
              ) : (data ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.fiscalYear}-{String(p.periodNumber).padStart(2, '0')}</TableCell>
                  <TableCell className="text-muted-foreground">{p.periodStart}</TableCell>
                  <TableCell className="text-muted-foreground">{p.periodEnd}</TableCell>
                  <TableCell><Badge variant={p.status === 'open' ? 'success' : 'secondary'}>{p.status === 'open' ? tt('açıq', 'open') : tt('bağlı', 'closed')}</Badge></TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => toggle(p)}>
                        {p.status === 'open' ? <><Lock className="h-4 w-4" /> {tt('Bağla', 'Close')}</> : <><Unlock className="h-4 w-4" /> {tt('Aç', 'Open')}</>}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}
