'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Pencil } from 'lucide-react';
import { listCustomers, createCustomer, updateCustomer } from '@/lib/firebase/sales';
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
import type { Customer } from '@/types';

export function CustomersTab({ companyId, canCreate, actorUid, baseCurrency }: {
  companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string;
}) {
  const qc = useQueryClient();
  const tt = useTT();
  const [edit, setEdit] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['customers', companyId], queryFn: () => listCustomers(companyId) });

  function openNew() { setEdit(null); setOpen(true); }
  function openEdit(c: Customer) { setEdit(c); setOpen(true); }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <ExportButton filename="musteriler" rows={data ?? []}
          columns={[
            { header: tt('Ad', 'Name'), value: 'name' }, { header: 'VÖEN', value: (c) => c.taxId ?? '' },
            { header: tt('Tip', 'Type'), value: (c) => c.type === 'legal_entity' ? tt('Hüquqi', 'Legal') : tt('Fərdi', 'Individual') },
            { header: tt('Ödəniş müddəti', 'Payment term'), value: (c) => c.paymentTermDays ?? 0 },
          ]} />
        {canCreate && <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> {tt('Yeni müştəri', 'New customer')}</Button>}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Müştəri yoxdur', 'No customers')} />
      ) : (
        <Card className="rounded-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{tt('Ad', 'Name')}</TableHead><TableHead>VÖEN</TableHead><TableHead>{tt('Tip', 'Type')}</TableHead><TableHead>{tt('Ödəniş müddəti', 'Payment term')}</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {(data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}{c.isRelatedParty && <Badge variant="secondary" className="ml-2">{tt('əlaqəli', 'related')}</Badge>}</TableCell>
                  <TableCell className="text-muted-foreground">{c.taxId ?? '—'}</TableCell>
                  <TableCell>{c.type === 'legal_entity' ? tt('Hüquqi şəxs', 'Legal entity') : tt('Fərdi', 'Individual')}</TableCell>
                  <TableCell>{c.paymentTermDays ?? 0} {tt('gün', 'days')}</TableCell>
                  <TableCell><Badge variant={c.isActive ? 'success' : 'secondary'}>{c.isActive ? tt('aktiv', 'active') : tt('deaktiv', 'inactive')}</Badge></TableCell>
                  <TableCell className="text-right">{canCreate && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
      <CustomerDialog open={open} onOpenChange={setOpen} companyId={companyId} actorUid={actorUid} baseCurrency={baseCurrency} edit={edit}
        onSaved={() => qc.invalidateQueries({ queryKey: ['customers', companyId] })} />
    </div>
  );
}

function CustomerDialog({ open, onOpenChange, companyId, actorUid, baseCurrency, edit, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; baseCurrency: string; edit: Customer | null; onSaved: () => void;
}) {
  const tt = useTT();
  const [name, setName] = useState('');
  const [type, setType] = useState<'individual' | 'legal_entity'>('legal_entity');
  const [taxId, setTaxId] = useState('');
  const [term, setTerm] = useState('30');
  const [related, setRelated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [key, setKey] = useState('');

  const k = (edit?.id ?? 'new') + (open ? '1' : '0');
  if (k !== key && open) {
    setKey(k);
    setName(edit?.name ?? ''); setType(edit?.type ?? 'legal_entity'); setTaxId(edit?.taxId ?? '');
    setTerm(String(edit?.paymentTermDays ?? 30)); setRelated(!!edit?.isRelatedParty);
  }

  async function save() {
    if (!name.trim()) { toast.error(tt('Ad tələb olunur', 'Name is required')); return; }
    setSaving(true);
    try {
      if (edit) {
        await updateCustomer(edit.id, { name: name.trim(), type, taxId: taxId.trim() || null, paymentTermDays: Number(term) || 0, isRelatedParty: related });
        toast.success(tt('Müştəri yeniləndi', 'Customer updated'));
      } else {
        await createCustomer({ companyId, type, name: name.trim(), taxId: taxId.trim() || null, defaultCurrency: baseCurrency, paymentTermDays: Number(term) || 0, isRelatedParty: related, isActive: true, createdBy: actorUid } as Parameters<typeof createCustomer>[0]);
        toast.success(tt('Müştəri əlavə edildi', 'Customer added'));
      }
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{edit ? tt('Müştərini redaktə et', 'Edit customer') : tt('Yeni müştəri', 'New customer')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>{tt('Ad', 'Name')} *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Tip', 'Type')}</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'individual' | 'legal_entity')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="legal_entity">{tt('Hüquqi şəxs', 'Legal entity')}</SelectItem><SelectItem value="individual">{tt('Fərdi şəxs', 'Individual')}</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>VÖEN</Label><Input value={taxId} onChange={(e) => setTaxId(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>{tt('Ödəniş müddəti (gün)', 'Payment term (days)')}</Label><Input type="number" value={term} onChange={(e) => setTerm(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={related} onChange={(e) => setRelated(e.target.checked)} /> {tt('Əlaqəli tərəf (IAS 24)', 'Related party (IAS 24)')}</label>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : null} {tt('Yadda saxla', 'Save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
