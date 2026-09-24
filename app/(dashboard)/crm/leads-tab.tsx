'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Pencil, Trash2, UserPlus, Target, ChevronDown } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  listLeads, createLead, updateLead, deleteLead, convertLeadToCustomer, convertLeadToOpportunity,
} from '@/lib/firebase/crm';
import { listTeamMembers } from '@/lib/firebase/tasks';
import { scoreLead } from '@/lib/crm/pipeline';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency } from '@/lib/utils/format';
import type { Lead, LeadSource, LeadStatus } from '@/types';
import type { CrmTabProps } from './page';

export const LEAD_STATUS: Record<LeadStatus, { az: string; en: string; v: 'secondary' | 'default' | 'success' | 'warning' | 'destructive' }> = {
  new: { az: 'yeni', en: 'new', v: 'secondary' },
  contacted: { az: 'təmasda', en: 'contacted', v: 'default' },
  qualified: { az: 'ixtisaslı', en: 'qualified', v: 'warning' },
  unqualified: { az: 'uyğun deyil', en: 'unqualified', v: 'secondary' },
  converted: { az: 'çevrildi', en: 'converted', v: 'success' },
  lost: { az: 'itirildi', en: 'lost', v: 'destructive' },
};
export const LEAD_SOURCE: Record<LeadSource, { az: string; en: string }> = {
  website: { az: 'Vebsayt', en: 'Website' }, referral: { az: 'Tövsiyə', en: 'Referral' },
  cold_call: { az: 'Soyuq zəng', en: 'Cold call' }, campaign: { az: 'Kampaniya', en: 'Campaign' },
  social: { az: 'Sosial media', en: 'Social' }, event: { az: 'Tədbir', en: 'Event' },
  partner: { az: 'Partnyor', en: 'Partner' }, inbound: { az: 'Daxil olan', en: 'Inbound' },
  other: { az: 'Digər', en: 'Other' },
};

export function LeadsTab({ companyId, canEdit, canConvert, actorUid, actorName, baseCurrency }: CrmTabProps) {
  const qc = useQueryClient();
  const tt = useTT();
  const { profile } = useAuth();
  const [edit, setEdit] = useState<Lead | 'new' | null>(null);
  const [convert, setConvert] = useState<Lead | null>(null);
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState('');
  const [sourceF, setSourceF] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['crmLeads', companyId], queryFn: () => listLeads(companyId) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['crmLeads', companyId] }); qc.invalidateQueries({ queryKey: ['crmOpportunities', companyId] }); qc.invalidateQueries({ queryKey: ['customers', companyId] }); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((l) => {
      if (statusF && l.status !== statusF) return false;
      if (sourceF && l.source !== sourceF) return false;
      if (q && !(`${l.leadNumber} ${l.name} ${l.contactName ?? ''} ${l.email ?? ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [data, search, statusF, sourceF]);

  async function remove(l: Lead) {
    if (!window.confirm(tt('Lead silinsin?', 'Delete lead?'))) return;
    try { await deleteLead(l.id); refresh(); } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
  }
  async function toCustomer(l: Lead) {
    try { await convertLeadToCustomer(l, baseCurrency, actorUid); toast.success(tt('Müştəriyə çevrildi', 'Converted to customer'), l.name); refresh(); }
    catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{tt('Potensial müştərilər — mənbə, qiymətləndirmə balı və çevirmə axını ilə.', 'Potential customers — with source, lead score and conversion flow.')}</p>
        <div className="flex gap-2">
          <ExportButton filename="leads" rows={data ?? []} columns={[
            { header: tt('Nömrə', 'Number'), value: 'leadNumber' }, { header: tt('Ad', 'Name'), value: 'name' },
            { header: tt('Mənbə', 'Source'), value: (l) => tt(LEAD_SOURCE[l.source]?.az ?? l.source, LEAD_SOURCE[l.source]?.en ?? l.source) },
            { header: 'Status', value: (l) => tt(LEAD_STATUS[l.status]?.az ?? l.status, LEAD_STATUS[l.status]?.en ?? l.status) },
            { header: tt('Bal', 'Score'), value: (l) => l.score ?? 0 }, { header: tt('Dəyər', 'Value'), value: (l) => l.estimatedValue ?? 0 },
          ]} />
          {canEdit && <Button size="sm" onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> {tt('Yeni lead', 'New lead')}</Button>}
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Lead yoxdur', 'No leads')} description={tt('İlk potensial müştərini əlavə edin.', 'Add the first lead.')} />
      ) : (
        <>
          <TableToolbar
            search={search} onSearch={setSearch} searchPlaceholder={tt('Ad, nömrə, e-poçt…', 'Name, number, email…')}
            count={filtered.length} total={(data ?? []).length}
            selects={[
              { value: statusF, onChange: setStatusF, placeholder: 'Status', options: (Object.keys(LEAD_STATUS) as LeadStatus[]).map((s) => ({ value: s, label: tt(LEAD_STATUS[s].az, LEAD_STATUS[s].en) })) },
              { value: sourceF, onChange: setSourceF, placeholder: tt('Mənbə', 'Source'), options: (Object.keys(LEAD_SOURCE) as LeadSource[]).map((s) => ({ value: s, label: tt(LEAD_SOURCE[s].az, LEAD_SOURCE[s].en) })) },
            ]}
          />
          {filtered.length === 0 ? <EmptyState title={tt('Nəticə yoxdur', 'No results')} /> : (
            <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{tt('Nömrə', 'Number')}</TableHead><TableHead>{tt('Ad', 'Name')}</TableHead><TableHead>{tt('Mənbə', 'Source')}</TableHead>
                  <TableHead>Status</TableHead><TableHead>{tt('Bal', 'Score')}</TableHead><TableHead className="text-right">{tt('Dəyər', 'Value')}</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filtered.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-mono text-xs">{l.leadNumber}</TableCell>
                      <TableCell className="font-medium">{l.name}{l.contactName && <span className="block text-xs text-muted-foreground">{l.contactName}</span>}</TableCell>
                      <TableCell className="text-muted-foreground">{tt(LEAD_SOURCE[l.source]?.az ?? l.source, LEAD_SOURCE[l.source]?.en ?? l.source)}</TableCell>
                      <TableCell><Badge variant={LEAD_STATUS[l.status]?.v ?? 'secondary'}>{tt(LEAD_STATUS[l.status]?.az ?? l.status, LEAD_STATUS[l.status]?.en ?? l.status)}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5"><div className="h-1.5 w-14 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-gradient-to-r from-[#5B5BF5] to-[#8b3df0]" style={{ width: `${l.score ?? 0}%` }} /></div><span className="tnum text-xs text-muted-foreground">{l.score ?? 0}</span></div>
                      </TableCell>
                      <TableCell className="text-right tnum">{l.estimatedValue ? formatCurrency(l.estimatedValue, l.currency ?? baseCurrency) : '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {canConvert && l.status !== 'converted' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="h-8"><Target className="h-3.5 w-3.5" /> {tt('Çevir', 'Convert')} <ChevronDown className="h-3 w-3" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setConvert(l)}><Target className="h-4 w-4" /> {tt('İmkana çevir', 'To opportunity')}</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => toCustomer(l)}><UserPlus className="h-4 w-4" /> {tt('Müştəriyə çevir', 'To customer')}</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEdit(l)}><Pencil className="h-4 w-4" /></Button>}
                          {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => remove(l)}><Trash2 className="h-4 w-4" /></Button>}
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

      {edit && <LeadDialog lead={edit === 'new' ? null : edit} companyId={companyId} actorUid={actorUid} actorName={actorName} baseCurrency={baseCurrency} self={profile} onClose={() => setEdit(null)} onSaved={refresh} />}
      {convert && <ConvertToOpportunityDialog lead={convert} actorUid={actorUid} actorName={actorName} baseCurrency={baseCurrency} onClose={() => setConvert(null)} onSaved={refresh} />}
    </div>
  );
}

function LeadDialog({ lead, companyId, actorUid, actorName, baseCurrency, self, onClose, onSaved }: {
  lead: Lead | null; companyId: string; actorUid: string; actorName: string | null; baseCurrency: string;
  self: ReturnType<typeof useAuth>['profile']; onClose: () => void; onSaved: () => void;
}) {
  const tt = useTT();
  const [name, setName] = useState(lead?.name ?? '');
  const [contactName, setContactName] = useState(lead?.contactName ?? '');
  const [email, setEmail] = useState(lead?.email ?? '');
  const [phone, setPhone] = useState(lead?.phone ?? '');
  const [source, setSource] = useState<LeadSource>(lead?.source ?? 'website');
  const [status, setStatus] = useState<LeadStatus>(lead?.status ?? 'new');
  const [industry, setIndustry] = useState(lead?.industry ?? '');
  const [value, setValue] = useState(String(lead?.estimatedValue ?? ''));
  const [nextFollowUp, setNextFollowUp] = useState(lead?.nextFollowUp ?? '');
  const [notes, setNotes] = useState(lead?.notes ?? '');
  const [busy, setBusy] = useState(false);

  const { data: members } = useQuery({ queryKey: ['teamMembers', companyId], queryFn: () => listTeamMembers(companyId, self ?? null, []), enabled: true });
  const [ownerUid, setOwnerUid] = useState(lead?.ownerUid ?? actorUid);

  async function save() {
    if (!name.trim()) { toast.error(tt('Ad tələb olunur', 'Name is required')); return; }
    const estimatedValue = value ? Number(value) : null;
    const owner = members?.find((m) => m.uid === ownerUid);
    const score = scoreLead({ source, email, phone, estimatedValue, status, industry });
    setBusy(true);
    try {
      const payload = {
        companyId, name: name.trim(), contactName: contactName.trim() || null, email: email.trim() || null, phone: phone.trim() || null,
        source, status, industry: industry.trim() || null, estimatedValue, currency: baseCurrency,
        ownerUid, ownerName: owner?.name ?? actorName ?? null, score, nextFollowUp: nextFollowUp || null, notes: notes.trim() || null,
      };
      if (lead) await updateLead(lead.id, payload);
      else await createLead({ ...payload, createdBy: actorUid });
      toast.success(lead ? tt('Lead yeniləndi', 'Lead updated') : tt('Lead yaradıldı', 'Lead created'));
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{lead ? tt('Lead-i redaktə et', 'Edit lead') : tt('Yeni lead', 'New lead')}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label>{tt('Təşkilat / ad', 'Organization / name')} *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Əlaqədar şəxs', 'Contact person')}</Label><Input value={contactName} onChange={(e) => setContactName(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Telefon', 'Phone')}</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+994 ..." /></div>
          <div className="space-y-2"><Label>{tt('E-poçt', 'Email')}</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Sahə', 'Industry')}</Label><Input value={industry} onChange={(e) => setIndustry(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Mənbə', 'Source')}</Label>
            <Select value={source} onValueChange={(v) => setSource(v as LeadSource)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(LEAD_SOURCE) as LeadSource[]).map((s) => <SelectItem key={s} value={s}>{tt(LEAD_SOURCE[s].az, LEAD_SOURCE[s].en)}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as LeadStatus)}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(LEAD_STATUS) as LeadStatus[]).filter((s) => s !== 'converted').map((s) => <SelectItem key={s} value={s}>{tt(LEAD_STATUS[s].az, LEAD_STATUS[s].en)}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>{tt('Təxmini dəyər', 'Estimated value')} ({baseCurrency})</Label><Input type="number" value={value} onChange={(e) => setValue(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Növbəti təmas', 'Next follow-up')}</Label><Input type="date" value={nextFollowUp} onChange={(e) => setNextFollowUp(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Məsul', 'Owner')}</Label>
            <Select value={ownerUid} onValueChange={setOwnerUid}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(members ?? []).map((m) => <SelectItem key={m.uid} value={m.uid}>{m.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2 sm:col-span-2"><Label>{tt('Qeydlər', 'Notes')}</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yadda saxla', 'Save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvertToOpportunityDialog({ lead, actorUid, actorName, baseCurrency, onClose, onSaved }: {
  lead: Lead; actorUid: string; actorName: string | null; baseCurrency: string; onClose: () => void; onSaved: () => void;
}) {
  const tt = useTT();
  const [title, setTitle] = useState(lead.name);
  const [amount, setAmount] = useState(String(lead.estimatedValue ?? ''));
  const [closeDate, setCloseDate] = useState('');
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!amount || Number(amount) <= 0) { toast.error(tt('Məbləğ daxil edin', 'Enter an amount')); return; }
    setBusy(true);
    try {
      await convertLeadToOpportunity(lead, { title: title.trim() || lead.name, amount: Number(amount), currency: lead.currency ?? baseCurrency, expectedCloseDate: closeDate || null }, actorUid, actorName ?? undefined);
      toast.success(tt('İmkana çevrildi', 'Converted to opportunity'), tt('Pipeline-də görünür', 'Now visible in the pipeline'));
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> {tt('İmkana çevir', 'Convert to opportunity')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>{tt('Başlıq', 'Title')}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Məbləğ', 'Amount')} ({lead.currency ?? baseCurrency})</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Gözlənilən bağlanma', 'Expected close')}</Label><Input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={run} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Target className="h-4 w-4" />} {tt('Çevir', 'Convert')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
