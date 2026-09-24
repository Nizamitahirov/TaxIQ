'use client';

import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2 } from 'lucide-react';
import { createSubAccount } from '@/lib/firebase/accounting';
import { CLASS_NAMES } from '@/lib/accounting/coa-template';
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
import { cn } from '@/lib/utils/cn';
import type { ChartAccount } from '@/types';

const TYPE_LABEL: Record<string, string> = {
  asset: 'Aktiv', liability: 'Öhdəlik', equity: 'Kapital', income: 'Gəlir', expense: 'Xərc',
};
const TYPE_LABEL_EN: Record<string, string> = {
  asset: 'Asset', liability: 'Liability', equity: 'Equity', income: 'Income', expense: 'Expense',
};

export function CoaTab({ companyId, accounts, canEdit, actorUid }: {
  companyId: string; accounts: ChartAccount[]; canEdit: boolean; actorUid: string;
}) {
  const qc = useQueryClient();
  const tt = useTT();
  const L = (o: { az: string; en: string }) => tt(o.az, o.en);
  const typeLabel = (t: string) => tt(TYPE_LABEL[t] ?? t, TYPE_LABEL_EN[t] ?? t);
  const [open, setOpen] = useState(false);

  const byClass = useMemo(() => {
    const m = new Map<number, ChartAccount[]>();
    for (const a of accounts) { if (!m.has(a.accountClass)) m.set(a.accountClass, []); m.get(a.accountClass)!.push(a); }
    return [...m.entries()].sort((x, y) => x[0] - y[0]);
  }, [accounts]);

  const postable = accounts.filter((a) => a.isPostable);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{tt('Sinif → Qrup → Hesab (rəsmi MMUS/IFRS struktur, 08 §1)', 'Class → Group → Account (official NAS/IFRS structure, 08 §1)')}</p>
        <div className="flex gap-2">
          <ExportButton
            filename="hesablar-plani"
            rows={accounts}
            columns={[
              { header: tt('Kod', 'Code'), value: 'accountCode' },
              { header: tt('Ad', 'Name'), value: (a) => L(a.accountName) },
              { header: tt('Sinif', 'Class'), value: 'accountClass' },
              { header: tt('Tip', 'Type'), value: (a) => typeLabel(a.accountType) },
              { header: tt('Normal qalıq', 'Normal balance'), value: 'normalBalance' },
            ]}
          />
          {canEdit && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> {tt('Alt-hesab', 'Sub-account')}</Button>}
        </div>
      </div>

      <div className="space-y-4">
        {byClass.map(([cls, rows]) => (
          <Card key={cls} className="rounded-card">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{cls}</span>
                <span className="font-semibold">{CLASS_NAMES[cls] ? L(CLASS_NAMES[cls]) : `${tt('Sinif', 'Class')} ${cls}`}</span>
              </div>
              <div className="divide-y divide-border/40">
                {rows.map((a) => (
                  <div key={a.id} className={cn('flex items-center gap-3 px-4 py-2 text-sm', !a.isPostable && 'bg-muted/30 font-semibold')}>
                    <span className={cn('w-14 shrink-0 font-mono', a.isSubAccount && 'pl-4')}>{a.accountCode}</span>
                    <span className="min-w-0 flex-1 truncate">{L(a.accountName)}</span>
                    {a.isSubAccount && <Badge variant="secondary">{tt('fərdi', 'custom')}</Badge>}
                    {a.isPostable && <span className="text-xs text-muted-foreground">{typeLabel(a.accountType)} · {a.normalBalance === 'debit' ? 'Dt' : 'Kt'}</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AddSubAccount open={open} onOpenChange={setOpen} companyId={companyId} parents={postable} actorUid={actorUid}
        onSaved={() => qc.invalidateQueries({ queryKey: ['coa', companyId] })} />
    </div>
  );
}

function AddSubAccount({ open, onOpenChange, companyId, parents, actorUid, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; companyId: string; parents: ChartAccount[]; actorUid: string; onSaved: () => void;
}) {
  const tt = useTT();
  const [parentId, setParentId] = useState('');
  const [code, setCode] = useState('');
  const [nameAz, setNameAz] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [saving, setSaving] = useState(false);
  const parent = parents.find((p) => p.id === parentId);

  async function save() {
    if (!parent || !code.trim() || !nameAz.trim()) { toast.error(tt('Ana hesab, kod və ad tələb olunur', 'Parent account, code and name are required')); return; }
    setSaving(true);
    try {
      await createSubAccount({ companyId, parent, code: code.trim(), nameAz: nameAz.trim(), nameEn: nameEn.trim(), createdBy: actorUid });
      toast.success(tt('Alt-hesab əlavə edildi', 'Sub-account added'));
      setCode(''); setNameAz(''); setNameEn(''); setParentId('');
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tt('Yeni alt-hesab', 'New sub-account')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{tt('Ana hesab', 'Parent account')}</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger><SelectValue placeholder={tt('Hesab seç', 'Select account')} /></SelectTrigger>
              <SelectContent className="max-h-72">{parents.map((p) => <SelectItem key={p.id} value={p.id}>{p.accountCode} — {tt(p.accountName.az, p.accountName.en)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>{tt('Kod', 'Code')}</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={parent ? `${parent.accountCode}.1` : ''} /></div>
            <div className="space-y-2"><Label>{tt('Ad (AZ)', 'Name (AZ)')}</Label><Input value={nameAz} onChange={(e) => setNameAz(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>{tt('Ad (EN)', 'Name (EN)')}</Label><Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} {tt('Əlavə et', 'Add')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
