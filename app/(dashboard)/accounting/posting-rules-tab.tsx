'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Settings2, RotateCcw, Save, ArrowRight } from 'lucide-react';
import {
  listPostingRules, resolvePostingRule, savePostingRule, resetPostingRule,
  defaultPostingRuleLines, POSTING_EVENT_TYPES, POSTING_EVENT_LABELS, AMOUNT_SOURCE_LABELS,
} from '@/lib/firebase/posting-rules';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import type { ChartAccount, PostingEventType, PostingRuleLine } from '@/types';

export function PostingRulesTab({ companyId, accounts, canManage, actorUid }: {
  companyId: string; accounts: ChartAccount[]; canManage: boolean; actorUid: string;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<PostingEventType | null>(null);
  const { data: overrides, isLoading } = useQuery({ queryKey: ['postingRules', companyId], queryFn: () => listPostingRules(companyId) });
  const overrideSet = useMemo(() => new Set((overrides ?? []).filter((r) => r.isActive).map((r) => r.eventType)), [overrides]);

  return (
    <div>
      <p className="mb-4 text-sm text-muted-foreground">
        Modul 5/6/7/10-dan gələn hər hadisə üçün avtomatik jurnal yazısında istifadə olunan hesab kodları (08 §2.3).
        Konfiqurasiya edilməyibsə sistem defoltu tətbiq olunur.
      </p>
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
        <div className="space-y-2">
          {POSTING_EVENT_TYPES.map((ev) => {
            const lines = defaultPostingRuleLines(ev);
            const custom = overrideSet.has(ev);
            const rendered = custom ? (overrides ?? []).find((r) => r.eventType === ev)?.lines ?? lines : lines;
            return (
              <Card key={ev} className="rounded-card">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{POSTING_EVENT_LABELS[ev]}</span>
                      {custom ? <Badge variant="warning">Fərdiləşdirilib</Badge> : <Badge variant="secondary">Defolt</Badge>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                      {rendered.map((l) => (
                        <span key={l.role} className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-1.5 py-0.5">
                          <span className={l.side === 'debit' ? 'text-primary' : 'text-muted-foreground'}>{l.side === 'debit' ? 'Dt' : 'Kt'}</span>
                          <span className="font-mono font-semibold">{l.accountCode}</span>
                          <span className="text-muted-foreground">{l.label}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                  {canManage && <Button variant="outline" size="sm" onClick={() => setEditing(ev)}><Settings2 className="h-4 w-4" /> Dəyiş</Button>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {!canManage && (overrides ?? []).length === 0 && !isLoading && (
        <div className="mt-4"><EmptyState title="Yalnız oxu" description="Posting qaydalarını dəyişmək üçün icazə (accounting.posting_rules.manage) lazımdır." /></div>
      )}
      {editing && (
        <EditDialog companyId={companyId} accounts={accounts} eventType={editing} actorUid={actorUid} hasOverride={overrideSet.has(editing)}
          onClose={() => setEditing(null)} onSaved={() => qc.invalidateQueries({ queryKey: ['postingRules', companyId] })} />
      )}
    </div>
  );
}

function EditDialog({ companyId, accounts, eventType, actorUid, hasOverride, onClose, onSaved }: {
  companyId: string; accounts: ChartAccount[]; eventType: PostingEventType; actorUid: string; hasOverride: boolean;
  onClose: () => void; onSaved: () => void;
}) {
  const postable = useMemo(() => accounts.filter((a) => a.isPostable).sort((a, b) => a.accountCode.localeCompare(b.accountCode)), [accounts]);
  const { data: current } = useQuery({ queryKey: ['postingRule', companyId, eventType], queryFn: () => resolvePostingRule(companyId, eventType) });
  const [lines, setLines] = useState<PostingRuleLine[] | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = lines ?? current?.lines ?? defaultPostingRuleLines(eventType);

  function setCode(role: string, accountCode: string) {
    setLines(rows.map((l) => l.role === role ? { ...l, accountCode } : l));
  }

  async function save() {
    setBusy(true);
    try { await savePostingRule(companyId, eventType, rows, actorUid); toast.success('Posting qaydası saxlanıldı'); onSaved(); onClose(); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }
  async function reset() {
    setBusy(true);
    try { await resetPostingRule(companyId, eventType, actorUid); toast.success('Defolta qaytarıldı'); onSaved(); onClose(); }
    catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings2 className="h-5 w-5 text-primary" /> {POSTING_EVENT_LABELS[eventType]}</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Hər sətir üçün istifadə olunacaq hesabı seçin. Debet/kredit tərəf və məbləğ mənbəyi sabitdir.</p>
        <div className="mt-3 space-y-2">
          {rows.map((l) => (
            <div key={l.role} className="grid grid-cols-[64px_1fr] items-center gap-3 rounded-lg border border-border/60 p-2.5 sm:grid-cols-[64px_180px_1fr]">
              <Badge variant={l.side === 'debit' ? 'default' : 'secondary'} className="justify-center">{l.side === 'debit' ? 'Debet' : 'Kredit'}</Badge>
              <div className="text-sm">
                <p className="font-medium">{l.label}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><ArrowRight className="h-3 w-3" /> {AMOUNT_SOURCE_LABELS[l.amountSource] ?? l.amountSource}</p>
              </div>
              <Select value={l.accountCode} onValueChange={(v) => setCode(l.role, v)}>
                <SelectTrigger><SelectValue placeholder="Hesab seç" /></SelectTrigger>
                <SelectContent className="max-h-72">{postable.map((a) => <SelectItem key={a.id} value={a.accountCode}>{a.accountCode} — {a.accountName.az}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {hasOverride ? <Button variant="ghost" onClick={reset} disabled={busy} className="text-danger"><RotateCcw className="h-4 w-4" /> Defolta qaytar</Button> : <span />}
          <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Yadda saxla</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
