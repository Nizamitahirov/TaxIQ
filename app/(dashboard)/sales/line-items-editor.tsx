'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { computeTotals } from '@/lib/firebase/sales';
import { formatCurrency } from '@/lib/utils/format';
import { useTT } from '@/lib/i18n/tt';
import type { DocLineItem } from '@/types';

export type DraftLine = Omit<DocLineItem, 'lineTotal'>;
export const emptyLine = (): DraftLine => ({ description: '', quantity: 1, unit: 'ədəd', unitPrice: 0, discountPercent: 0, vatRate: 18 });

export function LineItemsEditor({ lines, onChange, currency }: {
  lines: DraftLine[]; onChange: (l: DraftLine[]) => void; currency: string;
}) {
  const tt = useTT();
  const totals = computeTotals(lines.filter((l) => l.description || l.unitPrice));

  function set(i: number, patch: Partial<DraftLine>) {
    onChange(lines.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  const num = (v: string) => (v === '' ? 0 : Number(v));

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-1 py-1 text-left">{tt('Təsvir', 'Description')}</th>
              <th className="px-1 py-1 w-16">{tt('Say', 'Qty')}</th>
              <th className="px-1 py-1 w-24">{tt('Qiymət', 'Price')}</th>
              <th className="px-1 py-1 w-16">{tt('End%', 'Disc%')}</th>
              <th className="px-1 py-1 w-16">{tt('ƏDV%', 'VAT%')}</th>
              <th className="px-1 py-1 w-24 text-right">{tt('Cəm', 'Total')}</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const gross = l.quantity * l.unitPrice;
              const net = gross - gross * (l.discountPercent || 0) / 100;
              return (
                <tr key={i}>
                  <td className="px-1 py-1"><Input value={l.description} onChange={(e) => set(i, { description: e.target.value })} placeholder={tt('Mal / xidmət', 'Good / service')} /></td>
                  <td className="px-1 py-1"><Input type="number" value={l.quantity} onChange={(e) => set(i, { quantity: num(e.target.value) })} /></td>
                  <td className="px-1 py-1"><Input type="number" value={l.unitPrice} onChange={(e) => set(i, { unitPrice: num(e.target.value) })} /></td>
                  <td className="px-1 py-1"><Input type="number" value={l.discountPercent} onChange={(e) => set(i, { discountPercent: num(e.target.value) })} /></td>
                  <td className="px-1 py-1"><Input type="number" value={l.vatRate} onChange={(e) => set(i, { vatRate: num(e.target.value) })} /></td>
                  <td className="px-1 py-1 text-right tnum">{formatCurrency(net, currency)}</td>
                  <td className="px-1 py-1"><Button variant="ghost" size="icon" className="h-8 w-8 text-danger" onClick={() => onChange(lines.length > 1 ? lines.filter((_, idx) => idx !== i) : lines)}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Button variant="outline" size="sm" onClick={() => onChange([...lines, emptyLine()])}><Plus className="h-4 w-4" /> {tt('Sətir', 'Line')}</Button>
      <div className="flex justify-end gap-6 rounded-card border border-border bg-secondary/30 p-3 text-sm">
        <span className="text-muted-foreground">{tt('Ara cəm', 'Subtotal')}: <span className="font-medium text-foreground tnum">{formatCurrency(totals.subtotal - totals.discountTotal, currency)}</span></span>
        <span className="text-muted-foreground">{tt('ƏDV', 'VAT')}: <span className="font-medium text-foreground tnum">{formatCurrency(totals.vatTotal, currency)}</span></span>
        <span className="font-semibold">{tt('Yekun', 'Total')}: <span className="tnum">{formatCurrency(totals.grandTotal, currency)}</span></span>
      </div>
    </div>
  );
}
