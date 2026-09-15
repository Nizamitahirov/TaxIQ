'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Tag, Trash2, Pencil } from 'lucide-react';
import { listPriceLists, createPriceList, updatePriceList, listGoods } from '@/lib/firebase/inventory';
import { listCustomerGroups } from '@/lib/firebase/sales';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils/format';
import { useTT } from '@/lib/i18n/tt';
import type { PriceList, PriceListEntry, Good } from '@/types';

interface TabProps { companyId: string; canCreate: boolean; actorUid: string; baseCurrency: string }

export function PriceListsTab({ companyId, canCreate, actorUid, baseCurrency }: TabProps) {
  const qc = useQueryClient();
  const tt = useTT();
  const [edit, setEdit] = useState<PriceList | null>(null);
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['priceLists', companyId], queryFn: () => listPriceLists(companyId) });
  const { data: groups } = useQuery({ queryKey: ['customerGroups', companyId], queryFn: () => listCustomerGroups(companyId) });
  const { data: goods } = useQuery({ queryKey: ['goods', companyId], queryFn: () => listGoods(companyId) });
  const groupName = (id?: string | null) => id ? (groups?.find((g) => g.id === id)?.name ?? id) : tt('Ümumi', 'General');

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tt('Müştəri qrupu və sifariş miqdarı (tier) üzrə qiymətlər (05 §2). Satışda avtomatik tətbiq üçün əsas.', 'Prices by customer group and order quantity (tier) (05 §2). Basis for automatic application at sale time.')}</p>
        {canCreate && <Button size="sm" onClick={() => { setEdit(null); setOpen(true); }}><Plus className="h-4 w-4" /> {tt('Yeni siyahı', 'New list')}</Button>}
      </div>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (data ?? []).length === 0 ? (
        <EmptyState title={tt('Qiymət siyahısı yoxdur', 'No price lists')} description={tt('Müştəri qrupu üçün fərqli qiymətlər təyin edin.', 'Set different prices for a customer group.')} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data ?? []).map((pl) => (
            <Card key={pl.id} className="rounded-card"><CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Tag className="h-5 w-5" /></span>
                <Badge variant={pl.isActive ? 'success' : 'secondary'}>{pl.isActive ? tt('aktiv', 'active') : tt('passiv', 'inactive')}</Badge>
              </div>
              <p className="mt-3 font-semibold">{pl.name}</p>
              <p className="text-xs text-muted-foreground">{groupName(pl.customerGroupId)} · {pl.entries.length} {tt('sətir', 'lines')} · {pl.currency}</p>
              {canCreate && <div className="mt-3"><Button variant="outline" size="sm" onClick={() => { setEdit(pl); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /> {tt('Redaktə', 'Edit')}</Button></div>}
            </CardContent></Card>
          ))}
        </div>
      )}
      {canCreate && open && <PriceListDialog companyId={companyId} actorUid={actorUid} baseCurrency={baseCurrency} edit={edit}
        goods={goods ?? []} groups={groups ?? []} onClose={() => setOpen(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['priceLists', companyId] })} />}
    </div>
  );
}

function PriceListDialog({ companyId, actorUid, baseCurrency, edit, goods, groups, onClose, onSaved }: {
  companyId: string; actorUid: string; baseCurrency: string; edit: PriceList | null;
  goods: Good[]; groups: { id: string; name: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const tt = useTT();
  const [name, setName] = useState(edit?.name ?? '');
  const [groupId, setGroupId] = useState(edit?.customerGroupId ?? '');
  const [active, setActive] = useState(edit?.isActive ?? true);
  const [entries, setEntries] = useState<PriceListEntry[]>(edit?.entries ?? []);
  const [saving, setSaving] = useState(false);

  function addEntry() { const g = goods[0]; setEntries((e) => [...e, { goodId: g?.id ?? '', goodName: g?.name.az ?? '', minQty: 1, price: 0 }]); }
  function setEntry(i: number, p: Partial<PriceListEntry>) { setEntries((arr) => arr.map((x, idx) => idx === i ? { ...x, ...p } : x)); }

  async function save() {
    if (!name.trim()) { toast.error(tt('Ad tələb olunur', 'Name is required')); return; }
    const clean = entries.filter((e) => e.goodId);
    setSaving(true);
    try {
      const payload = { companyId, name: name.trim(), customerGroupId: groupId || null, currency: baseCurrency, entries: clean, isActive: active };
      if (edit) { await updatePriceList(edit.id, payload); toast.success(tt('Yeniləndi', 'Updated')); }
      else { await createPriceList({ ...payload, createdBy: actorUid }); toast.success(tt('Yaradıldı', 'Created')); }
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setSaving(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{edit ? tt('Qiymət siyahısını redaktə et', 'Edit price list') : tt('Yeni qiymət siyahısı', 'New price list')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Ad', 'Name')}</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={tt('B2B topdan', 'B2B wholesale')} /></div>
            <div className="space-y-2"><Label>{tt('Müştəri qrupu', 'Customer group')}</Label>
              <Select value={groupId || 'none'} onValueChange={(v) => setGroupId(v === 'none' ? '' : v)}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">{tt('Ümumi (bütün müştərilər)', 'General (all customers)')}</SelectItem>{groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-xs">{tt('Qiymət sətirləri (mal · min. miqdar · qiymət)', 'Price lines (good · min. qty · price)')}</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addEntry} disabled={goods.length === 0}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
            {entries.length === 0 ? <p className="text-xs text-muted-foreground">{tt('Sətir əlavə edin. Eyni mal üçün fərqli min. miqdar = miqdar endirimi (tier).', 'Add a line. Different min. qty for the same good = quantity discount (tier).')}</p> : entries.map((e, i) => (
              <div key={i} className="mb-1 flex items-center gap-1">
                <Select value={e.goodId} onValueChange={(v) => setEntry(i, { goodId: v, goodName: goods.find((g) => g.id === v)?.name.az })}><SelectTrigger className="h-8 flex-1 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{goods.map((g) => <SelectItem key={g.id} value={g.id}>{tt(g.name.az, g.name.en)}</SelectItem>)}</SelectContent></Select>
                <Input className="h-8 w-20 text-xs" type="number" placeholder="min" value={e.minQty} onChange={(ev) => setEntry(i, { minQty: Number(ev.target.value) })} />
                <Input className="h-8 w-24 text-xs" type="number" placeholder={tt('qiymət', 'price')} value={e.price} onChange={(ev) => setEntry(i, { price: Number(ev.target.value) })} />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => setEntries((arr) => arr.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {tt('Aktiv', 'Active')}</label>
          <p className="text-xs text-muted-foreground">{tt('Valyuta', 'Currency')}: {formatCurrency(0, baseCurrency).replace(/[\d.,\s]/g, '') || baseCurrency}</p>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : null} {tt('Yadda saxla', 'Save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
