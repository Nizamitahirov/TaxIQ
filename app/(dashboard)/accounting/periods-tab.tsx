'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Lock, Unlock, Plus } from 'lucide-react';
import { listPeriods, ensurePeriod, closePeriod, reopenPeriod } from '@/lib/firebase/accounting';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import type { AccountingPeriod } from '@/types';

export function PeriodsTab({ companyId, canManage, actorUid }: { companyId: string; canManage: boolean; actorUid: string }) {
  const qc = useQueryClient();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['periods', companyId], queryFn: () => listPeriods(companyId) });

  function refresh() { qc.invalidateQueries({ queryKey: ['periods', companyId] }); }

  async function addPeriod() {
    setBusy(true);
    try { await ensurePeriod(companyId, `${month}-01`); toast.success('Dövr yaradıldı'); refresh(); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }
  async function toggle(p: AccountingPeriod) {
    setBusy(true);
    try {
      if (p.status === 'open') { await closePeriod(p.id, actorUid); toast.success('Dövr bağlandı'); }
      else {
        const reason = window.prompt('Dövrü yenidən açmaq üçün səbəb (audit-ə yazılır):') ?? '';
        if (!reason.trim()) { setBusy(false); return; }
        await reopenPeriod(p.id, actorUid, reason.trim()); toast.success('Dövr yenidən açıldı');
      }
      refresh();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Bağlı dövrə yazı aparıla bilməz; yenidən açma səbəb + audit tələb edir (08 §4)</p>
        {canManage && (
          <div className="flex items-end gap-2">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
            <Button size="sm" onClick={addPeriod} disabled={busy}><Plus className="h-4 w-4" /> Dövr aç</Button>
          </div>
        )}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Dövr</TableHead><TableHead>Başlanğıc</TableHead><TableHead>Son</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Dövr yoxdur</TableCell></TableRow>
              ) : (data ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.fiscalYear}-{String(p.periodNumber).padStart(2, '0')}</TableCell>
                  <TableCell className="text-muted-foreground">{p.periodStart}</TableCell>
                  <TableCell className="text-muted-foreground">{p.periodEnd}</TableCell>
                  <TableCell><Badge variant={p.status === 'open' ? 'success' : 'secondary'}>{p.status === 'open' ? 'açıq' : 'bağlı'}</Badge></TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <Button variant="ghost" size="sm" disabled={busy} onClick={() => toggle(p)}>
                        {p.status === 'open' ? <><Lock className="h-4 w-4" /> Bağla</> : <><Unlock className="h-4 w-4" /> Aç</>}
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
