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
import { cn } from '@/lib/utils/cn';
import type { ChartAccount } from '@/types';

const TYPE_LABEL: Record<string, string> = {
  asset: 'Aktiv', liability: 'Öhdəlik', equity: 'Kapital', income: 'Gəlir', expense: 'Xərc',
};

export function CoaTab({ companyId, accounts, canEdit, actorUid }: {
  companyId: string; accounts: ChartAccount[]; canEdit: boolean; actorUid: string;
}) {
  const qc = useQueryClient();
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
        <p className="text-sm text-muted-foreground">Sinif → Qrup → Hesab (rəsmi MMUS/IFRS struktur, 08 §1)</p>
        <div className="flex gap-2">
          <ExportButton
            filename="hesablar-plani"
            rows={accounts}
            columns={[
              { header: 'Kod', value: 'accountCode' },
              { header: 'Ad', value: (a) => a.accountName.az },
              { header: 'Sinif', value: 'accountClass' },
              { header: 'Tip', value: (a) => TYPE_LABEL[a.accountType] },
              { header: 'Normal qalıq', value: 'normalBalance' },
            ]}
          />
          {canEdit && <Button size="sm" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Alt-hesab</Button>}
        </div>
      </div>

      <div className="space-y-4">
        {byClass.map(([cls, rows]) => (
          <Card key={cls} className="rounded-card">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{cls}</span>
                <span className="font-semibold">{CLASS_NAMES[cls]?.az ?? `Sinif ${cls}`}</span>
              </div>
              <div className="divide-y divide-border/40">
                {rows.map((a) => (
                  <div key={a.id} className={cn('flex items-center gap-3 px-4 py-2 text-sm', !a.isPostable && 'bg-muted/30 font-semibold')}>
                    <span className={cn('w-14 shrink-0 font-mono', a.isSubAccount && 'pl-4')}>{a.accountCode}</span>
                    <span className="min-w-0 flex-1 truncate">{a.accountName.az}</span>
                    {a.isSubAccount && <Badge variant="secondary">fərdi</Badge>}
                    {a.isPostable && <span className="text-xs text-muted-foreground">{TYPE_LABEL[a.accountType]} · {a.normalBalance === 'debit' ? 'Dt' : 'Kt'}</span>}
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
  const [parentId, setParentId] = useState('');
  const [code, setCode] = useState('');
  const [nameAz, setNameAz] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [saving, setSaving] = useState(false);
  const parent = parents.find((p) => p.id === parentId);

  async function save() {
    if (!parent || !code.trim() || !nameAz.trim()) { toast.error('Ana hesab, kod və ad tələb olunur'); return; }
    setSaving(true);
    try {
      await createSubAccount({ companyId, parent, code: code.trim(), nameAz: nameAz.trim(), nameEn: nameEn.trim(), createdBy: actorUid });
      toast.success('Alt-hesab əlavə edildi');
      setCode(''); setNameAz(''); setNameEn(''); setParentId('');
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Yeni alt-hesab</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Ana hesab</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger><SelectValue placeholder="Hesab seç" /></SelectTrigger>
              <SelectContent className="max-h-72">{parents.map((p) => <SelectItem key={p.id} value={p.id}>{p.accountCode} — {p.accountName.az}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Kod</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={parent ? `${parent.accountCode}.1` : ''} /></div>
            <div className="space-y-2"><Label>Ad (AZ)</Label><Input value={nameAz} onChange={(e) => setNameAz(e.target.value)} /></div>
          </div>
          <div className="space-y-2"><Label>Ad (EN)</Label><Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Plus className="h-4 w-4" />} Əlavə et</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
