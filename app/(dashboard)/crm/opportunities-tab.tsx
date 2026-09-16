'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Pencil, Trash2, FileText } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { listOpportunities, createOpportunity, updateOpportunity, deleteOpportunity, opportunityToQuote } from '@/lib/firebase/crm';
import { listCustomers } from '@/lib/firebase/sales';
import { listTeamMembers } from '@/lib/firebase/tasks';
import { STAGES, STAGE_MAP, defaultProbability } from '@/lib/crm/pipeline';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { TableToolbar } from '@/components/shared/table-toolbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency, formatDate } from '@/lib/utils/format';
import { LineItemsEditor, emptyLine, type DraftLine } from '../sales/line-items-editor';
import type { Opportunity, OpportunityStage } from '@/types';
import type { CrmTabProps } from './page';

export function OpportunitiesTab({ companyId, canEdit, canConvert, actorUid, actorName, baseCurrency }: CrmTabProps) {
  const qc = useQueryClient();
  const tt = useTT();
  const { profile } = useAuth();
  const [edit, setEdit] = useState<Opportunity | 'new' | null>(null);
  const [quote, setQuote] = useState<Opportunity | null>(null);
  const [search, setSearch] = useState('');
  const [stageF, setStageF] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['crmOpportunities', companyId], queryFn: () => listOpportunities(companyId) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['crmOpportunities', companyId] }); qc.invalidateQueries({ queryKey: ['quotes', companyId] }); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((o) => {
      if (stageF && o.stage !== stageF) return false;
      if (q && !(`${o.opportunityNumber} ${o.title} ${o.customerName ?? ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data, search, stageF]);

  async function remove(o: Opportunity) {
    if (!window.confirm(tt('İmkan silinsin?', 'Delete opportunity?'))) return;
    try { await deleteOpportunity(o.id); refresh(); } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{tt('Satış imkanları — mərhələ, çəkili proqnoz və təklifə çevirmə.', 'Sales opportunities — stage, weighted forecast and quote conversion.')}</p>
        <div className="flex gap-2">
          <ExportButton filename="imkanlar" rows={data ?? []} columns={[
            { header: tt('Nömrə', 'Number'), value: 'opportunityNumber' }, { header: tt('Başlıq', 'Title'), value: 'title' },
            { header: tt('Müştəri', 'Customer'), value: (o) => o.customerName ?? '' },
            { header: tt('Mərhələ', 'Stage'), value: (o) => tt(STAGE_MAP[o.stage]?.az ?? o.stage, STAGE_MAP[o.stage]?.en ?? o.stage) },
            { header: tt('Məbləğ', 'Amount'), value: 'amount' }, { header: tt('Ehtimal', 'Probability'), value: (o) => `${o.probability}%` },
          ]} />
          {canEdit && <Button size="sm" onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> {tt('Yeni imkan', 'New opportunity')}</Button>}
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('İmkan yoxdur', 'No opportunities')} />
      ) : (
        <>
          <TableToolbar
            search={search} onSearch={setSearch} searchPlaceholder={tt('Başlıq, nömrə, müştəri…', 'Title, number, customer…')}
            count={filtered.length} total={(data ?? []).length}
            selects={[{ value: stageF, onChange: setStageF, placeholder: tt('Mərhələ', 'Stage'), options: STAGES.map((s) => ({ value: s.key, label: tt(s.az, s.en) })) }]}
          />
          {filtered.length === 0 ? <EmptyState title={tt('Nəticə yoxdur', 'No results')} /> : (
            <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{tt('Nömrə', 'Number')}</TableHead><TableHead>{tt('Başlıq', 'Title')}</TableHead><TableHead>{tt('Müştəri', 'Customer')}</TableHead>
                  <TableHead>{tt('Mərhələ', 'Stage')}</TableHead><TableHead className="text-right">{tt('Məbləğ', 'Amount')}</TableHead>
                  <TableHead>{tt('Bağlanma', 'Close')}</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs">{o.opportunityNumber}</TableCell>
                      <TableCell className="font-medium">{o.title}{o.wonQuoteId && <Badge variant="outline" className="ml-2 text-[10px]">{tt('təklifli', 'quoted')}</Badge>}</TableCell>
                      <TableCell className="text-muted-foreground">{o.customerName ?? '—'}</TableCell>
                      <TableCell><Badge variant="secondary"><span className={STAGE_MAP[o.stage]?.tint}>●</span>&nbsp;{tt(STAGE_MAP[o.stage]?.az ?? o.stage, STAGE_MAP[o.stage]?.en ?? o.stage)} · {o.probability}%</Badge></TableCell>
                      <TableCell className="text-right tnum font-semibold">{formatCurrency(o.amount, o.currency)}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{o.expectedCloseDate ? formatDate(new Date(o.expectedCloseDate).getTime()) : '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canConvert && o.customerId && !o.wonQuoteId && <Button variant="outline" size="sm" className="h-8" onClick={() => setQuote(o)}><FileText className="h-3.5 w-3.5" /> {tt('Təklif', 'Quote')}</Button>}
                          {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEdit(o)}><Pencil className="h-4 w-4" /></Button>}
                          {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => remove(o)}><Trash2 className="h-4 w-4" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          )}
        </>
      )}

      {edit && <OpportunityDialog opp={edit === 'new' ? null : edit} companyId={companyId} actorUid={actorUid} actorName={actorName} baseCurrency={baseCurrency} self={profile} onClose={() => setEdit(null)} onSaved={refresh} />}
      {quote && <QuoteDialog opp={quote} actorUid={actorUid} onClose={() => setQuote(null)} onSaved={refresh} />}
    </div>
  );
}

function OpportunityDialog({ opp, companyId, actorUid, actorName, baseCurrency, self, onClose, onSaved }: {
  opp: Opportunity | null; companyId: string; actorUid: string; actorName: string | null; baseCurrency: string;
  self: ReturnType<typeof useAuth>['profile']; onClose: () => void; onSaved: () => void;
}) {
  const tt = useTT();
  const [title, setTitle] = useState(opp?.title ?? '');
  const [customerId, setCustomerId] = useState(opp?.customerId ?? '');
  const [amount, setAmount] = useState(String(opp?.amount ?? ''));
  const [stage, setStage] = useState<OpportunityStage>(opp?.stage ?? 'qualification');
  const [prob, setProb] = useState(String(opp?.probability ?? defaultProbability('qualification')));
  const [closeDate, setCloseDate] = useState(opp?.expectedCloseDate ?? '');
  const [nextStep, setNextStep] = useState(opp?.nextStep ?? '');
  const [ownerUid, setOwnerUid] = useState(opp?.ownerUid ?? actorUid);
  const [busy, setBusy] = useState(false);

  const { data: customers } = useQuery({ queryKey: ['customers', companyId], queryFn: () => listCustomers(companyId) });
  const { data: members } = useQuery({ queryKey: ['teamMembers', companyId], queryFn: () => listTeamMembers(companyId, self ?? null, []) });

  function onStage(v: string) { const s = v as OpportunityStage; setStage(s); setProb(String(defaultProbability(s))); }

  async function save() {
    if (!title.trim()) { toast.error(tt('Başlıq tələb olunur', 'Title is required')); return; }
    if (!amount || Number(amount) <= 0) { toast.error(tt('Məbləğ daxil edin', 'Enter an amount')); return; }
    const cust = customers?.find((c) => c.id === customerId);
    const owner = members?.find((m) => m.uid === ownerUid);
    setBusy(true);
    try {
      const payload = {
        companyId, title: title.trim(), customerId: customerId || null, customerName: cust?.name ?? opp?.customerName ?? null,
        stage, amount: Number(amount), currency: opp?.currency ?? baseCurrency, probability: Number(prob) || defaultProbability(stage),
        expectedCloseDate: closeDate || null, nextStep: nextStep.trim() || null, ownerUid, ownerName: owner?.name ?? actorName ?? null,
      };
      if (opp) await updateOpportunity(opp.id, payload);
      else await createOpportunity({ ...payload, createdBy: actorUid });
      toast.success(opp ? tt('İmkan yeniləndi', 'Opportunity updated') : tt('İmkan yaradıldı', 'Opportunity created'));
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{opp ? tt('İmkanı redaktə et', 'Edit opportunity') : tt('Yeni imkan', 'New opportunity')}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label>{tt('Başlıq', 'Title')} *</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Müştəri', 'Customer')}</Label>
            <Select value={customerId} onValueChange={setCustomerId}><SelectTrigger><SelectValue placeholder={tt('Seç (opsional)', 'Select (optional)')} /></SelectTrigger>
              <SelectContent>{(customers ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>{tt('Məbləğ', 'Amount')} ({opp?.currency ?? baseCurrency})</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Mərhələ', 'Stage')}</Label>
            <Select value={stage} onValueChange={onStage}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{tt(s.az, s.en)}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>{tt('Ehtimal', 'Probability')} %</Label><Input type="number" value={prob} onChange={(e) => setProb(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Gözlənilən bağlanma', 'Expected close')}</Label><Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Məsul', 'Owner')}</Label>
            <Select value={ownerUid} onValueChange={setOwnerUid}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(members ?? []).map((m) => <SelectItem key={m.uid} value={m.uid}>{m.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2 sm:col-span-2"><Label>{tt('Növbəti addım', 'Next step')}</Label><Input value={nextStep} onChange={(e) => setNextStep(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yadda saxla', 'Save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuoteDialog({ opp, actorUid, onClose, onSaved }: { opp: Opportunity; actorUid: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [lines, setLines] = useState<DraftLine[]>([{ ...emptyLine(), description: opp.title, unitPrice: opp.amount }]);
  const [busy, setBusy] = useState(false);

  async function run() {
    const valid = lines.filter((l) => l.description && l.unitPrice > 0);
    if (valid.length === 0) { toast.error(tt('Ən azı 1 sətir', 'At least 1 line')); return; }
    setBusy(true);
    try {
      await opportunityToQuote(opp, { lineItems: valid }, actorUid);
      toast.success(tt('Təklif yaradıldı', 'Quote created'), tt('Satış → Təklif/Sifariş bölməsində', 'In Sales → Quote/Order'));
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> {tt('Təklifə çevir', 'Convert to quote')} — {opp.customerName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <LineItemsEditor lines={lines} onChange={setLines} currency={opp.currency} />
          <p className="text-xs text-muted-foreground">{tt('Kommersiya təklifi Satış modulunda yaradılır və imkana bağlanır.', 'A sales quote is created in the Sales module and linked to this opportunity.')}</p>
        </div>
        <DialogFooter><Button onClick={run} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <FileText className="h-4 w-4" />} {tt('Təklif yarat', 'Create quote')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
