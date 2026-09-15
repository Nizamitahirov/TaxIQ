'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Trash2, Undo2, Scale } from 'lucide-react';
import { listJournalEntries, postJournalEntry, reverseEntry } from '@/lib/firebase/accounting';
import { listDepartments } from '@/lib/firebase/departments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ExportButton } from '@/components/shared/export-button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { ChartAccount, JournalEntry, JournalLine } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

export function JournalTab({ companyId, accounts, canPost, actorUid, baseCurrency }: {
  companyId: string; accounts: ChartAccount[]; canPost: boolean; actorUid: string; baseCurrency: string;
}) {
  const qc = useQueryClient();
  const tt = useTT();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['journal', companyId], queryFn: () => listJournalEntries(companyId) });

  async function doReverse(e: JournalEntry) {
    setBusyId(e.id);
    try { await reverseEntry(e, actorUid); toast.success(tt('Əks yazı yaradıldı', 'Reversing entry created')); qc.invalidateQueries({ queryKey: ['journal', companyId] }); qc.invalidateQueries({ queryKey: ['trial', companyId] }); }
    catch (err) { toast.error(tt('Xəta', 'Error'), err instanceof Error ? err.message : undefined); }
    finally { setBusyId(null); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tt('İkili yazılış — balanslaşmamış yazı qəbul olunmur (08 §2.2)', 'Double-entry — unbalanced entries are rejected (08 §2.2)')}</p>
        <div className="flex gap-2">
          <ExportButton filename="emeliyyat-jurnali" rows={data ?? []}
            columns={[
              { header: tt('Nömrə', 'Number'), value: 'entryNumber' },
              { header: tt('Tarix', 'Date'), value: (e) => e.entryDateStr ?? '' },
              { header: tt('Təsvir', 'Description'), value: 'description' },
              { header: tt('Mənbə', 'Source'), value: 'sourceType' },
              { header: tt('Dt cəmi', 'Total Dr'), value: 'totalDebit' },
              { header: tt('Kt cəmi', 'Total Cr'), value: 'totalCredit' },
              { header: 'Status', value: 'status' },
            ]} />
          {canPost && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Yeni yazı', 'New entry')}</Button>}
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <Card className="rounded-card"><CardContent className="py-12 text-center text-sm text-muted-foreground">{tt('Jurnal yazısı yoxdur', 'No journal entries')}</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((e) => (
            <Card key={e.id} className="rounded-card">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{e.entryNumber}</span>
                      <Badge variant="secondary">{e.sourceType}</Badge>
                      {e.status === 'reversed' && <Badge variant="warning">{tt('əks edilib', 'reversed')}</Badge>}
                    </div>
                    <p className="mt-0.5 text-sm">{e.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(e.entryDateStr ? new Date(e.entryDateStr).getTime() : null)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tnum">{formatCurrency(e.totalDebit, baseCurrency)}</span>
                    {canPost && e.status === 'posted' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={tt('Əks yazı', 'Reverse entry')} disabled={busyId === e.id} onClick={() => doReverse(e)}>
                        {busyId === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-2 overflow-x-auto rounded-lg border border-border/50">
                  <table className="w-full text-sm">
                    <tbody>
                      {e.lines.map((l, i) => (
                        <tr key={i} className="border-b border-border/30 last:border-0">
                          <td className="px-3 py-1.5 font-mono text-xs text-muted-foreground">{l.accountCode}</td>
                          <td className="px-3 py-1.5">{l.accountName}</td>
                          <td className="px-3 py-1.5 text-right tnum">{l.debit ? formatCurrency(l.debit, baseCurrency) : ''}</td>
                          <td className="px-3 py-1.5 text-right tnum text-muted-foreground">{l.credit ? formatCurrency(l.credit, baseCurrency) : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {canPost && <NewEntryDialog open={open} onOpenChange={setOpen} companyId={companyId} accounts={accounts} actorUid={actorUid} baseCurrency={baseCurrency}
        onSaved={() => { qc.invalidateQueries({ queryKey: ['journal', companyId] }); qc.invalidateQueries({ queryKey: ['trial', companyId] }); }} />}
    </div>
  );
}

interface DraftLine { accountId: string; debit: string; credit: string }
const emptyLine = (): DraftLine => ({ accountId: '', debit: '', credit: '' });

function NewEntryDialog({ open, onOpenChange, companyId, accounts, actorUid, baseCurrency, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; accounts: ChartAccount[]; actorUid: string; baseCurrency: string; onSaved: () => void;
}) {
  const tt = useTT();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);
  const postable = useMemo(() => accounts.filter((a) => a.isPostable), [accounts]);
  const { data: departments } = useQuery({ queryKey: ['departments', companyId], queryFn: () => listDepartments(companyId), enabled: open });

  const totalDebit = round2(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
  const totalCredit = round2(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
  const diff = round2(totalDebit - totalCredit);
  const balanced = diff === 0 && totalDebit > 0;

  function setLine(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  async function save() {
    if (!balanced) { toast.error(tt('Yazı balanslaşdırılmayıb', 'Entry is not balanced')); return; }
    const jlines: JournalLine[] = lines
      .filter((l) => l.accountId && (Number(l.debit) || Number(l.credit)))
      .map((l) => {
        const acct = postable.find((a) => a.id === l.accountId);
        return { accountId: l.accountId, accountCode: acct?.accountCode, accountName: acct?.accountName.az, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, departmentId: departmentId || null };
      });
    setSaving(true);
    try {
      await postJournalEntry({ companyId, entryDate: date, description, lines: jlines, createdBy: actorUid, baseCurrency });
      toast.success(tt('Jurnal yazısı əlavə edildi', 'Journal entry added'));
      setLines([emptyLine(), emptyLine()]); setDescription(''); setDepartmentId('');
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error(tt('Yazı alınmadı', 'Entry failed'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>{tt('Əl ilə jurnal yazısı', 'Manual journal entry')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
            <div className="space-y-2"><Label>{tt('Tarix', 'Date')}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Təsvir', 'Description')}</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={tt('Əməliyyatın təsviri', 'Transaction description')} /></div>
          </div>
          {(departments ?? []).length > 0 && (
            <div className="space-y-2">
              <Label>{tt('Şöbə / Xərc mərkəzi', 'Department / Cost center')} <span className="text-xs font-normal text-muted-foreground">{tt('(seçimlik — şöbə üzrə M&K üçün)', '(optional — for departmental P&L)')}</span></Label>
              <Select value={departmentId || 'none'} onValueChange={(v) => setDepartmentId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder={tt('Yoxdur', 'None')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tt('Yoxdur', 'None')}</SelectItem>
                  {(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{tt(d.name.az, d.name.en)}{d.type !== 'department' ? ` (${d.type === 'cost_center' ? tt('xərc mərkəzi', 'cost center') : tt('layihə', 'project')})` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={l.accountId} onValueChange={(v) => setLine(i, { accountId: v })}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder={tt('Hesab', 'Account')} /></SelectTrigger>
                  <SelectContent className="max-h-72">{postable.map((a) => <SelectItem key={a.id} value={a.id}>{a.accountCode} — {tt(a.accountName.az, a.accountName.en)}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="w-28" type="number" placeholder={tt('Debet', 'Debit')} value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: '' })} />
                <Input className="w-28" type="number" placeholder={tt('Kredit', 'Credit')} value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: '' })} />
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-danger" onClick={() => setLines((p) => p.length > 2 ? p.filter((_, idx) => idx !== i) : p)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLines((p) => [...p, emptyLine()])}><Plus className="h-4 w-4" /> {tt('Sətir əlavə et', 'Add line')}</Button>
          </div>

          <div className={cn('flex items-center justify-between rounded-card border p-3 text-sm', balanced ? 'border-success/40 bg-success/10' : 'border-warning/40 bg-warning/10')}>
            <span className="flex items-center gap-2 font-medium"><Scale className="h-4 w-4" /> {balanced ? tt('Balanslaşdırılıb', 'Balanced') : `${tt('Balanslaşdırılmayıb: fərq', 'Not balanced: difference')} ${formatCurrency(Math.abs(diff), baseCurrency)}`}</span>
            <span className="tnum text-muted-foreground">Dt {formatCurrency(totalDebit, baseCurrency)} · Kt {formatCurrency(totalCredit, baseCurrency)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={!balanced || saving}>{saving ? <Loader2 className="animate-spin" /> : null} {tt('Yazını qeyd et', 'Post entry')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
