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
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { ChartAccount, JournalEntry, JournalLine } from '@/types';

const round2 = (n: number) => Math.round(n * 100) / 100;

export function JournalTab({ companyId, accounts, canPost, actorUid, baseCurrency }: {
  companyId: string; accounts: ChartAccount[]; canPost: boolean; actorUid: string; baseCurrency: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['journal', companyId], queryFn: () => listJournalEntries(companyId) });

  async function doReverse(e: JournalEntry) {
    setBusyId(e.id);
    try { await reverseEntry(e, actorUid); toast.success('Əks yazı yaradıldı'); qc.invalidateQueries({ queryKey: ['journal', companyId] }); qc.invalidateQueries({ queryKey: ['trial', companyId] }); }
    catch (err) { toast.error('Xəta', err instanceof Error ? err.message : undefined); }
    finally { setBusyId(null); }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">İkili yazılış — balanslaşmamış yazı qəbul olunmur (08 §2.2)</p>
        <div className="flex gap-2">
          <ExportButton filename="emeliyyat-jurnali" rows={data ?? []}
            columns={[
              { header: 'Nömrə', value: 'entryNumber' },
              { header: 'Tarix', value: (e) => e.entryDateStr ?? '' },
              { header: 'Təsvir', value: 'description' },
              { header: 'Mənbə', value: 'sourceType' },
              { header: 'Dt cəmi', value: 'totalDebit' },
              { header: 'Kt cəmi', value: 'totalCredit' },
              { header: 'Status', value: 'status' },
            ]} />
          {canPost && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Yeni yazı</Button>}
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <Card className="rounded-card"><CardContent className="py-12 text-center text-sm text-muted-foreground">Jurnal yazısı yoxdur</CardContent></Card>
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
                      {e.status === 'reversed' && <Badge variant="warning">əks edilib</Badge>}
                    </div>
                    <p className="mt-0.5 text-sm">{e.description}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(e.entryDateStr ? new Date(e.entryDateStr).getTime() : null)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold tnum">{formatCurrency(e.totalDebit, baseCurrency)}</span>
                    {canPost && e.status === 'posted' && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Əks yazı" disabled={busyId === e.id} onClick={() => doReverse(e)}>
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
    if (!balanced) { toast.error('Yazı balanslaşdırılmayıb'); return; }
    const jlines: JournalLine[] = lines
      .filter((l) => l.accountId && (Number(l.debit) || Number(l.credit)))
      .map((l) => {
        const acct = postable.find((a) => a.id === l.accountId);
        return { accountId: l.accountId, accountCode: acct?.accountCode, accountName: acct?.accountName.az, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, departmentId: departmentId || null };
      });
    setSaving(true);
    try {
      await postJournalEntry({ companyId, entryDate: date, description, lines: jlines, createdBy: actorUid, baseCurrency });
      toast.success('Jurnal yazısı əlavə edildi');
      setLines([emptyLine(), emptyLine()]); setDescription(''); setDepartmentId('');
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error('Yazı alınmadı', e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Əl ilə jurnal yazısı</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
            <div className="space-y-2"><Label>Tarix</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Təsvir</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Əməliyyatın təsviri" /></div>
          </div>
          {(departments ?? []).length > 0 && (
            <div className="space-y-2">
              <Label>Şöbə / Xərc mərkəzi <span className="text-xs font-normal text-muted-foreground">(seçimlik — şöbə üzrə M&K üçün)</span></Label>
              <Select value={departmentId || 'none'} onValueChange={(v) => setDepartmentId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Yoxdur" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Yoxdur</SelectItem>
                  {(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name.az}{d.type !== 'department' ? ` (${d.type === 'cost_center' ? 'xərc mərkəzi' : 'layihə'})` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <Select value={l.accountId} onValueChange={(v) => setLine(i, { accountId: v })}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Hesab" /></SelectTrigger>
                  <SelectContent className="max-h-72">{postable.map((a) => <SelectItem key={a.id} value={a.id}>{a.accountCode} — {a.accountName.az}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="w-28" type="number" placeholder="Debet" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: '' })} />
                <Input className="w-28" type="number" placeholder="Kredit" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: '' })} />
                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-danger" onClick={() => setLines((p) => p.length > 2 ? p.filter((_, idx) => idx !== i) : p)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLines((p) => [...p, emptyLine()])}><Plus className="h-4 w-4" /> Sətir əlavə et</Button>
          </div>

          <div className={cn('flex items-center justify-between rounded-card border p-3 text-sm', balanced ? 'border-success/40 bg-success/10' : 'border-warning/40 bg-warning/10')}>
            <span className="flex items-center gap-2 font-medium"><Scale className="h-4 w-4" /> {balanced ? 'Balanslaşdırılıb' : `Balanslaşdırılmayıb: fərq ${formatCurrency(Math.abs(diff), baseCurrency)}`}</span>
            <span className="tnum text-muted-foreground">Dt {formatCurrency(totalDebit, baseCurrency)} · Kt {formatCurrency(totalCredit, baseCurrency)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={!balanced || saving}>{saving ? <Loader2 className="animate-spin" /> : null} Yazını qeyd et</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
