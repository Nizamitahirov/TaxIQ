'use client';

import { useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { createFixedAsset } from '@/lib/firebase/accounting';
import { AZ_ASSET_CATEGORIES, ASSET_CATEGORY_MAP, DEFAULT_ASSET_CATEGORY } from '@/lib/accounting/asset-categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import type { ChartAccount, FixedAsset } from '@/types';

/** Vergi Məcəlləsi m.114 kateqoriyaları + amortizasiya metodu ilə əsas vəsait yaradan ortaq dialoq. */
export function FixedAssetDialog({ open, onOpenChange, companyId, actorUid, onSaved, accounts }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; actorUid: string; onSaved: () => void;
  accounts?: ChartAccount[];
}) {
  const tt = useTT();
  const [name, setName] = useState('');
  const [cost, setCost] = useState('');
  const [residual, setResidual] = useState('0');
  const [acqDate, setAcqDate] = useState(new Date().toISOString().slice(0, 10));
  const [categoryKey, setCategoryKey] = useState<string>(DEFAULT_ASSET_CATEGORY);
  const [method, setMethod] = useState<FixedAsset['depreciationMethod']>(ASSET_CATEGORY_MAP[DEFAULT_ASSET_CATEGORY].defaultMethod);
  const [rate, setRate] = useState(String(ASSET_CATEGORY_MAP[DEFAULT_ASSET_CATEGORY].taxRate));
  const [life, setLife] = useState('60');
  const [assetAccountId, setAssetAccountId] = useState('');
  const [saving, setSaving] = useState(false);
  const assetAccounts = (accounts ?? []).filter((a) => a.accountType === 'asset' && a.isPostable);

  /** Kateqoriya seçiləndə qanunvericilik norması + tövsiyə metodu avtomatik dolur. */
  function pickCategory(key: string) {
    setCategoryKey(key);
    const c = ASSET_CATEGORY_MAP[key];
    if (c) { setRate(String(c.taxRate)); setMethod(c.defaultMethod); }
  }

  function reset() { setName(''); setCost(''); setResidual('0'); setLife('60'); setCategoryKey(DEFAULT_ASSET_CATEGORY); pickCategory(DEFAULT_ASSET_CATEGORY); }

  async function save() {
    if (!name.trim() || !cost) { toast.error(tt('Ad və dəyər tələb olunur', 'Name and cost are required')); return; }
    setSaving(true);
    try {
      await createFixedAsset({
        companyId, assetName: name.trim(), assetAccountId: assetAccountId || undefined,
        acquisitionDate: acqDate, acquisitionCost: Number(cost), categoryKey,
        depreciationMethod: method, usefulLifeMonths: Number(life) || 60, residualValue: Number(residual) || 0,
        reducingBalanceRate: method === 'reducing_balance' ? Number(rate) : null, departmentId: null, createdBy: actorUid,
      });
      toast.success(tt('Əsas vəsait əlavə edildi', 'Fixed asset added'));
      reset();
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{tt('Yeni əsas vəsait', 'New fixed asset')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>{tt('Ad', 'Name')}</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder={tt('məs. Ofis kompüteri', 'e.g. Office computer')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Dəyər', 'Cost')}</Label><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></div>
            <div className="space-y-2"><Label>{tt('Qalıq (ləğv) dəyəri', 'Residual value')}</Label><Input type="number" value={residual} onChange={(e) => setResidual(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>{tt('Alınma tarixi', 'Acquisition date')}</Label><Input type="date" value={acqDate} onChange={(e) => setAcqDate(e.target.value)} /></div>

          <div className="space-y-2">
            <Label>{tt('Kateqoriya (Vergi Məcəlləsi m.114)', 'Category (Tax Code Art.114)')}</Label>
            <Select value={categoryKey} onValueChange={pickCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{AZ_ASSET_CATEGORIES.map((c) => <SelectItem key={c.key} value={c.key}>{tt(c.name.az, c.name.en)} — {c.taxRate}%</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{tt('Vergi uçotu üçün default metod azalan qalıqdır; faiz kateqoriyanın illik maksimum normasıdır.', 'For tax purposes the default method is reducing balance; the rate is the category’s statutory annual maximum.')}</p>
          </div>

          <div className="space-y-2">
            <Label>{tt('Amortizasiya metodu', 'Depreciation method')}</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as FixedAsset['depreciationMethod'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="reducing_balance">{tt('Azalan qalıq (vergi metodu)', 'Reducing balance (tax method)')}</SelectItem>
                <SelectItem value="straight_line">{tt('Xətti (straight-line)', 'Straight-line')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {method === 'reducing_balance'
              ? <div className="space-y-2"><Label>{tt('İllik faiz (%)', 'Annual rate (%)')}</Label><Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} /></div>
              : <div className="space-y-2"><Label>{tt('Faydalı ömür (ay)', 'Useful life (months)')}</Label><Input type="number" value={life} onChange={(e) => setLife(e.target.value)} /></div>}
            {method === 'reducing_balance' && <div className="space-y-2"><Label>{tt('Faydalı ömür (ay)', 'Useful life (months)')}</Label><Input type="number" value={life} onChange={(e) => setLife(e.target.value)} /></div>}
          </div>

          {assetAccounts.length > 0 && (
            <div className="space-y-2">
              <Label>{tt('Aktiv hesabı (opsional)', 'Asset account (optional)')}</Label>
              <Select value={assetAccountId} onValueChange={setAssetAccountId}>
                <SelectTrigger><SelectValue placeholder={tt('Hesab seç', 'Select account')} /></SelectTrigger>
                <SelectContent className="max-h-60">{assetAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.accountCode} — {tt(a.accountName.az, a.accountName.en)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Əlavə et', 'Add')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
