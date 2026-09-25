'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, FileSignature, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listContracts, createContract, updateContract, deleteContract, contractHealth } from '@/lib/firebase/contracts';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils/format';
import type { Contract, ContractType, ContractStatus, ContractParty } from '@/types';

const TYPE_LABEL: Record<ContractType, [string, string]> = {
  sales: ['Satış', 'Sales'], purchase: ['Alış', 'Purchase'], service: ['Xidmət', 'Service'],
  lease: ['İcarə', 'Lease'], employment: ['Əmək', 'Employment'], nda: ['NDA (məxfilik)', 'NDA'], other: ['Digər', 'Other'],
};
const STATUS_META: Record<ContractStatus, { label: [string, string]; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: ['Layihə', 'Draft'], variant: 'secondary' },
  active: { label: ['Aktiv', 'Active'], variant: 'default' },
  expired: { label: ['Bitmiş', 'Expired'], variant: 'outline' },
  terminated: { label: ['Ləğv edilmiş', 'Terminated'], variant: 'destructive' },
  renewed: { label: ['Uzadılmış', 'Renewed'], variant: 'default' },
};
const PARTY_LABEL: Record<ContractParty, [string, string]> = {
  customer: ['Müştəri', 'Customer'], vendor: ['Təchizatçı', 'Vendor'], employee: ['İşçi', 'Employee'], other: ['Digər', 'Other'],
};

export default function ContractsPage() {
  const tt = useTT();
  const qc = useQueryClient();
  const { active, isSuperAdmin, can, profile } = useAuth();
  const companyId = active?.companyId;
  const cur = active?.company.baseCurrency ?? 'AZN';
  const canView = isSuperAdmin || can('sales.customer.view') || can('sales.invoice.view') || can('cashbank.transaction.view') || can('hr.employee.view');
  const canEdit = isSuperAdmin || can('sales.invoice.create') || can('platform.company.create') || can('hr.leave.create');
  const [editing, setEditing] = useState<Contract | 'new' | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | ContractStatus>('all');

  const { data, isLoading } = useQuery({ queryKey: ['contracts', companyId], queryFn: () => listContracts(companyId!), enabled: canView && !!companyId });
  const rows = useMemo(() => (data ?? []).filter((c) => statusFilter === 'all' || c.status === statusFilter), [data, statusFilter]);
  const expiring = useMemo(() => (data ?? []).filter((c) => contractHealth(c).expiringSoon), [data]);

  async function remove(c: Contract) {
    if (!confirm(tt('Müqavilə silinsin?', 'Delete contract?'))) return;
    await deleteContract(c, profile?.uid ?? '');
    qc.invalidateQueries({ queryKey: ['contracts', companyId] });
  }

  if (!companyId) return <div><PageHeader title={tt('Müqavilələr', 'Contracts')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canView) return <div><PageHeader title={tt('Müqavilələr', 'Contracts')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader
        title={tt('Müqavilələr', 'Contracts')}
        subtitle={tt('Müştəri, təchizatçı və işçi müqavilələrinin mərkəzi reyestri', 'Central registry of customer, vendor and employee contracts')}
        action={canEdit && <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> {tt('Yeni müqavilə', 'New contract')}</Button>}
      />

      {expiring.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-card border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>{tt(`${expiring.length} müqavilənin bitmə tarixi yaxınlaşır`, `${expiring.length} contract(s) expiring soon`)}: {expiring.slice(0, 3).map((c) => c.contractNumber).join(', ')}{expiring.length > 3 ? '…' : ''}</span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        {(['all', 'active', 'draft', 'expired', 'terminated', 'renewed'] as const).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            {s === 'all' ? tt('Hamısı', 'All') : tt(STATUS_META[s].label[0], STATUS_META[s].label[1])}
          </button>
        ))}
      </div>

      {isLoading ? <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : rows.length === 0 ? <EmptyState title={tt('Müqavilə yoxdur', 'No contracts')} action={canEdit && <Button onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> {tt('Yeni müqavilə', 'New contract')}</Button>} />
        : (
          <Card className="rounded-card"><CardContent className="p-0"><div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>№</TableHead><TableHead>{tt('Başlıq', 'Title')}</TableHead><TableHead>{tt('Tərəf', 'Party')}</TableHead>
                <TableHead>{tt('Növ', 'Type')}</TableHead><TableHead>{tt('Müddət', 'Term')}</TableHead>
                <TableHead className="text-right">{tt('Dəyər', 'Value')}</TableHead><TableHead>{tt('Status', 'Status')}</TableHead>
                {canEdit && <TableHead className="w-20" />}
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((c) => {
                  const h = contractHealth(c);
                  const sm = STATUS_META[c.status];
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.contractNumber}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{c.title}</TableCell>
                      <TableCell>{c.partyName}<span className="ml-1 text-xs text-muted-foreground">({tt(PARTY_LABEL[c.partyKind][0], PARTY_LABEL[c.partyKind][1])})</span></TableCell>
                      <TableCell className="text-muted-foreground">{tt(TYPE_LABEL[c.type][0], TYPE_LABEL[c.type][1])}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.startDate}{c.endDate ? ` → ${c.endDate}` : ''}
                        {h.expiringSoon && <span className="ml-1 rounded bg-amber-500/15 px-1 text-amber-600">{tt(`${h.daysLeft} gün`, `${h.daysLeft}d`)}</span>}
                      </TableCell>
                      <TableCell className="text-right tnum">{c.value != null ? formatCurrency(c.value, c.currency || cur) : '—'}</TableCell>
                      <TableCell><Badge variant={sm.variant}>{tt(sm.label[0], sm.label[1])}</Badge></TableCell>
                      {canEdit && <TableCell><div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={() => remove(c)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div></TableCell>}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div></CardContent></Card>
        )}

      {editing && <EditDialog companyId={companyId} cur={cur} actorUid={profile?.uid ?? ''} contract={editing === 'new' ? null : editing}
        onClose={() => setEditing(null)} onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ['contracts', companyId] }); }} />}
    </div>
  );
}

function EditDialog({ companyId, cur, actorUid, contract, onClose, onSaved }: { companyId: string; cur: string; actorUid: string; contract: Contract | null; onClose: () => void; onSaved: () => void }) {
  const tt = useTT();
  const [f, setF] = useState({
    title: contract?.title ?? '', type: contract?.type ?? 'service' as ContractType, partyKind: contract?.partyKind ?? 'customer' as ContractParty,
    partyName: contract?.partyName ?? '', startDate: contract?.startDate ?? new Date().toISOString().slice(0, 10),
    endDate: contract?.endDate ?? '', renewalNoticeDays: String(contract?.renewalNoticeDays ?? 30),
    value: contract?.value != null ? String(contract.value) : '', currency: contract?.currency ?? cur,
    status: contract?.status ?? 'active' as ContractStatus, notes: contract?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p }));

  async function save() {
    if (!f.title.trim() || !f.partyName.trim()) { toast.error(tt('Başlıq və tərəf məcburidir', 'Title and party are required')); return; }
    setSaving(true);
    try {
      const payload = {
        companyId, title: f.title.trim(), type: f.type, partyKind: f.partyKind, partyId: contract?.partyId ?? null,
        partyName: f.partyName.trim(), startDate: f.startDate, endDate: f.endDate || null,
        renewalNoticeDays: Number(f.renewalNoticeDays) || null, value: f.value ? Number(f.value) : null,
        currency: f.currency, status: f.status, responsibleUserId: contract?.responsibleUserId ?? actorUid,
        fileUrl: contract?.fileUrl ?? null, notes: f.notes.trim() || null,
      };
      if (contract) await updateContract(contract.id, payload, actorUid);
      else await createContract({ ...payload, createdBy: actorUid });
      toast.success(tt('Yadda saxlanıldı', 'Saved'));
      onSaved();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{contract ? tt('Müqaviləni redaktə et', 'Edit contract') : tt('Yeni müqavilə', 'New contract')}</DialogTitle></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2"><Label>{tt('Başlıq *', 'Title *')}</Label><Input value={f.title} onChange={(e) => set({ title: e.target.value })} /></div>
          <div className="space-y-1"><Label>{tt('Növ', 'Type')}</Label>
            <Select value={f.type} onValueChange={(v) => set({ type: v as ContractType })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{tt(v[0], v[1])}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>{tt('Tərəf növü', 'Party kind')}</Label>
            <Select value={f.partyKind} onValueChange={(v) => set({ partyKind: v as ContractParty })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(PARTY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{tt(v[0], v[1])}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1 sm:col-span-2"><Label>{tt('Tərəfin adı *', 'Party name *')}</Label><Input value={f.partyName} onChange={(e) => set({ partyName: e.target.value })} /></div>
          <div className="space-y-1"><Label>{tt('Başlama', 'Start')}</Label><Input type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} /></div>
          <div className="space-y-1"><Label>{tt('Bitmə', 'End')}</Label><Input type="date" value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} /></div>
          <div className="space-y-1"><Label>{tt('Dəyər', 'Value')}</Label><Input type="number" value={f.value} onChange={(e) => set({ value: e.target.value })} /></div>
          <div className="space-y-1"><Label>{tt('Xəbərdarlıq (gün)', 'Notice (days)')}</Label><Input type="number" value={f.renewalNoticeDays} onChange={(e) => set({ renewalNoticeDays: e.target.value })} /></div>
          <div className="space-y-1"><Label>{tt('Status', 'Status')}</Label>
            <Select value={f.status} onValueChange={(v) => set({ status: v as ContractStatus })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(STATUS_META).map(([k, v]) => <SelectItem key={k} value={k}>{tt(v.label[0], v.label[1])}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>{tt('Valyuta', 'Currency')}</Label><Input value={f.currency} onChange={(e) => set({ currency: e.target.value })} /></div>
          <div className="space-y-1 sm:col-span-2"><Label>{tt('Qeyd', 'Notes')}</Label><Input value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{tt('Ləğv', 'Cancel')}</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} {tt('Yadda saxla', 'Save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
