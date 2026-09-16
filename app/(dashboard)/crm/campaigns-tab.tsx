'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { listCampaigns, createCampaign, updateCampaign, deleteCampaign } from '@/lib/firebase/crm';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
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
import { formatCurrency } from '@/lib/utils/format';
import type { Campaign } from '@/types';
import type { CrmTabProps } from './page';

const CHANNEL: Record<Campaign['channel'], { az: string; en: string }> = {
  email: { az: 'E-poçt', en: 'Email' }, social: { az: 'Sosial media', en: 'Social' }, event: { az: 'Tədbir', en: 'Event' },
  ads: { az: 'Reklam', en: 'Ads' }, referral: { az: 'Tövsiyə', en: 'Referral' }, other: { az: 'Digər', en: 'Other' },
};
const CSTATUS: Record<Campaign['status'], { az: string; en: string; v: 'secondary' | 'default' | 'success' | 'warning' }> = {
  planned: { az: 'planlaşdırılıb', en: 'planned', v: 'secondary' }, active: { az: 'aktiv', en: 'active', v: 'default' },
  completed: { az: 'tamamlanıb', en: 'completed', v: 'success' }, cancelled: { az: 'ləğv', en: 'cancelled', v: 'warning' },
};

export function CampaignsTab({ companyId, canEdit, actorUid, baseCurrency }: CrmTabProps) {
  const qc = useQueryClient();
  const tt = useTT();
  const [edit, setEdit] = useState<Campaign | 'new' | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['crmCampaigns', companyId], queryFn: () => listCampaigns(companyId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['crmCampaigns', companyId] });

  async function remove(c: Campaign) {
    if (!window.confirm(tt('Kampaniya silinsin?', 'Delete campaign?'))) return;
    try { await deleteCampaign(c.id); refresh(); } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{tt('Marketinq kampaniyaları — lead mənbəyi kimi bağlana bilər.', 'Marketing campaigns — can be linked as a lead source.')}</p>
        <div className="flex gap-2">
          <ExportButton filename="kampaniyalar" rows={data ?? []} columns={[
            { header: tt('Ad', 'Name'), value: 'name' }, { header: tt('Kanal', 'Channel'), value: (c) => tt(CHANNEL[c.channel]?.az ?? c.channel, CHANNEL[c.channel]?.en ?? c.channel) },
            { header: 'Status', value: (c) => tt(CSTATUS[c.status]?.az ?? c.status, CSTATUS[c.status]?.en ?? c.status) }, { header: tt('Büdcə', 'Budget'), value: (c) => c.budget ?? 0 },
          ]} />
          {canEdit && <Button size="sm" onClick={() => setEdit('new')}><Plus className="h-4 w-4" /> {tt('Yeni kampaniya', 'New campaign')}</Button>}
        </div>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Kampaniya yoxdur', 'No campaigns')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{tt('Ad', 'Name')}</TableHead><TableHead>{tt('Kanal', 'Channel')}</TableHead><TableHead>Status</TableHead><TableHead>{tt('Müddət', 'Period')}</TableHead><TableHead className="text-right">{tt('Büdcə', 'Budget')}</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{tt(CHANNEL[c.channel]?.az ?? c.channel, CHANNEL[c.channel]?.en ?? c.channel)}</TableCell>
                  <TableCell><Badge variant={CSTATUS[c.status]?.v ?? 'secondary'}>{tt(CSTATUS[c.status]?.az ?? c.status, CSTATUS[c.status]?.en ?? c.status)}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.startDate ?? '—'}{c.endDate ? ` → ${c.endDate}` : ''}</TableCell>
                  <TableCell className="text-right tnum">{c.budget ? formatCurrency(c.budget, c.currency ?? baseCurrency) : '—'}</TableCell>
                  <TableCell className="text-right">{canEdit && <div className="flex justify-end gap-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEdit(c)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => remove(c)}><Trash2 className="h-4 w-4" /></Button></div>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      {edit && <CampaignDialog campaign={edit === 'new' ? null : edit} companyId={companyId} actorUid={actorUid} baseCurrency={baseCurrency} onClose={() => setEdit(null)} onSaved={refresh} />}
    </div>
  );
}

function CampaignDialog({ campaign, companyId, actorUid, baseCurrency, onClose, onSaved }: { campaign: Campaign | null; companyId: string; actorUid: string; baseCurrency: string; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [name, setName] = useState(campaign?.name ?? '');
  const [channel, setChannel] = useState<Campaign['channel']>(campaign?.channel ?? 'email');
  const [status, setStatus] = useState<Campaign['status']>(campaign?.status ?? 'planned');
  const [startDate, setStartDate] = useState(campaign?.startDate ?? '');
  const [endDate, setEndDate] = useState(campaign?.endDate ?? '');
  const [budget, setBudget] = useState(String(campaign?.budget ?? ''));
  const [target, setTarget] = useState(campaign?.target ?? '');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) { toast.error(tt('Ad tələb olunur', 'Name is required')); return; }
    setBusy(true);
    try {
      const payload = { companyId, name: name.trim(), channel, status, startDate: startDate || null, endDate: endDate || null, budget: budget ? Number(budget) : null, currency: baseCurrency, target: target.trim() || null };
      if (campaign) await updateCampaign(campaign.id, payload);
      else await createCampaign({ ...payload, createdBy: actorUid });
      toast.success(campaign ? tt('Kampaniya yeniləndi', 'Campaign updated') : tt('Kampaniya yaradıldı', 'Campaign created'));
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{campaign ? tt('Kampaniyanı redaktə et', 'Edit campaign') : tt('Yeni kampaniya', 'New campaign')}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label>{tt('Ad', 'Name')} *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Kanal', 'Channel')}</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as Campaign['channel'])}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(CHANNEL) as Campaign['channel'][]).map((c) => <SelectItem key={c} value={c}>{tt(CHANNEL[c].az, CHANNEL[c].en)}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as Campaign['status'])}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(CSTATUS) as Campaign['status'][]).map((s) => <SelectItem key={s} value={s}>{tt(CSTATUS[s].az, CSTATUS[s].en)}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="space-y-2"><Label>{tt('Başlanğıc', 'Start')}</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Bitmə', 'End')}</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Büdcə', 'Budget')} ({baseCurrency})</Label><Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tt('Hədəf auditoriya', 'Target audience')}</Label><Input value={target} onChange={(e) => setTarget(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Yadda saxla', 'Save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
