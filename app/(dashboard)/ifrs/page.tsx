'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2, AlertTriangle, FileBarChart, Building2, SlidersHorizontal, Save, BookText } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import {
  generateBalanceSheet, generateProfitLoss, generateCashFlow, generateEquityChanges,
  generateFixedAssetSchedule, generateAccountingPolicies,
  yearPeriod, type FinancialStatement, type NotesDocument,
} from '@/lib/ifrs/engine';
import { getStatementTemplate, saveStatementTemplate, applyStatementTemplate } from '@/lib/firebase/financial-statements';
import { listDepartments } from '@/lib/firebase/departments';
import { usePeriod } from '@/components/providers/period-provider';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ExportButton } from '@/components/shared/export-button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { FinancialStatementTemplate } from '@/types';

type StatementType = 'balance_sheet' | 'profit_loss' | 'cash_flow' | 'equity_changes' | 'fixed_asset_schedule' | 'accounting_policies';
const TYPES: { value: StatementType; label: string }[] = [
  { value: 'balance_sheet', label: 'Maliyyə Vəziyyəti (Balans)' },
  { value: 'profit_loss', label: 'Mənfəət və Zərər' },
  { value: 'cash_flow', label: 'Pul Vəsaitlərinin Hərəkəti' },
  { value: 'equity_changes', label: 'Kapitalda Dəyişikliklər' },
  { value: 'fixed_asset_schedule', label: 'Əsas Vəsaitlərin Hərəkəti' },
  { value: 'accounting_policies', label: 'Uçot Siyasəti və Qeydlər' },
];
const TEMPLATABLE = new Set<StatementType>(['balance_sheet', 'profit_loss', 'cash_flow', 'equity_changes', 'fixed_asset_schedule']);

export default function IfrsPage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const qc = useQueryClient();
  const companyId = active?.companyId;
  const allowed = isSuperAdmin || can('accounting.reports.ifrs.view');
  const canManage = isSuperAdmin || can('accounting.reports.ifrs.export');
  const nowYear = new Date().getFullYear();
  const [type, setType] = useState<StatementType>('balance_sheet');
  const { year, setYear } = usePeriod();
  const [departmentId, setDepartmentId] = useState<string>('');
  const [tplOpen, setTplOpen] = useState(false);

  const { data: departments } = useQuery({ queryKey: ['departments', companyId], queryFn: () => listDepartments(companyId!), enabled: !!companyId && allowed });
  const { data: tpl } = useQuery({
    queryKey: ['stmtTpl', companyId, type],
    queryFn: () => TEMPLATABLE.has(type) ? getStatementTemplate(companyId!, type as FinancialStatementTemplate['statementType']) : Promise.resolve(null),
    enabled: !!companyId && allowed,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['ifrs', companyId, type, year, departmentId, tpl?.id, tpl?.updatedAt],
    queryFn: async (): Promise<FinancialStatement | NotesDocument> => {
      const cur = yearPeriod(year);
      const prior = yearPeriod(year - 1);
      if (type === 'balance_sheet') return applyStatementTemplate(await generateBalanceSheet(companyId!, cur, prior), tpl);
      if (type === 'profit_loss') return applyStatementTemplate(await generateProfitLoss(companyId!, cur, prior, departmentId || null), tpl);
      if (type === 'cash_flow') return applyStatementTemplate(await generateCashFlow(companyId!, cur, prior), tpl);
      if (type === 'equity_changes') return applyStatementTemplate(await generateEquityChanges(companyId!, cur), tpl);
      if (type === 'fixed_asset_schedule') return applyStatementTemplate(await generateFixedAssetSchedule(companyId!, cur), tpl);
      return generateAccountingPolicies({ companyId: companyId!, companyName: active?.company.name ?? '', baseCurrency: active?.company.baseCurrency ?? 'AZN', year });
    },
    enabled: !!companyId && allowed,
  });

  if (!companyId) return <div><PageHeader title="IFRS Hesabatlar" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Aktiv şirkət seçin.</CardContent></Card></div>;
  if (!allowed) return <div><PageHeader title="IFRS Hesabatlar" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">İcazə yoxdur (accounting.reports.ifrs.view).</CardContent></Card></div>;

  const base = active?.company.baseCurrency ?? 'AZN';
  const isNotes = type === 'accounting_policies';
  const stmt = !isNotes ? (data as FinancialStatement | undefined) : undefined;
  const notes = isNotes ? (data as NotesDocument | undefined) : undefined;
  const showComparison = (type === 'balance_sheet' || type === 'profit_loss') && (tpl?.showComparative ?? true);

  return (
    <div>
      <PageHeader
        title="IFRS Maliyyə Hesabatları"
        subtitle={`${active?.company.name} · IAS 1 (Modul 9) · Modul 8 qalıqlarından avtomatik`}
        action={stmt && (
          <div className="flex gap-2">
            {canManage && TEMPLATABLE.has(type) && <Button variant="outline" size="sm" onClick={() => setTplOpen(true)}><SlidersHorizontal className="h-4 w-4" /> Şablon</Button>}
            <ExportButton filename={`ifrs-${type}-${year}`} rows={stmt.rows}
              columns={[
                { header: 'Maddə', value: 'label' },
                { header: `Cari (${year})`, value: 'current' },
                ...(showComparison ? [{ header: `Əvvəlki (${year - 1})`, value: 'prior' as const }] : []),
              ]} />
          </div>
        )}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={type} onValueChange={(v) => setType(v as StatementType)}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
        {!isNotes && (
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{[0, 1, 2, 3].map((i) => <SelectItem key={i} value={String(nowYear - i)}>{nowYear - i}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {type === 'profit_loss' && (departments ?? []).length > 0 && (
          <Select value={departmentId || 'all'} onValueChange={(v) => setDepartmentId(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-56"><Building2 className="mr-1 h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Bütün şöbələr" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Bütün şöbələr (konsolidə)</SelectItem>
              {(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name.az}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading || !data ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : isNotes && notes ? (
        <Card className="rounded-card"><CardContent className="p-0">
          <div className="border-b border-border p-5 text-center">
            <BookText className="mx-auto mb-2 h-6 w-6 text-primary" />
            <p className="text-lg font-bold">{notes.title}</p>
            <p className="text-sm text-muted-foreground">{active?.company.name} · VÖEN {active?.company.taxId || '—'} · {notes.periodLabel}</p>
          </div>
          <div className="space-y-5 p-6">
            {notes.sections.map((s, i) => (
              <div key={i}>
                <h3 className="mb-1.5 font-semibold text-primary">{s.heading}</h3>
                {s.body.map((p, j) => <p key={j} className="mb-1 text-sm leading-relaxed text-foreground/85">{p}</p>)}
              </div>
            ))}
          </div>
          <p className="border-t border-border px-6 py-3 text-xs text-muted-foreground">Bu bölmə Fayl 5 (ehtiyat metodu) və Fayl 8 (amortizasiya metodu) seçimlərinə avtomatik istinad edir — əl ilə uyğunsuzluq riski aradan qalxır (09 §7).</p>
        </CardContent></Card>
      ) : stmt && (
        <Card className="rounded-card">
          <CardContent className="p-0">
            <div className="border-b border-border p-5 text-center">
              <FileBarChart className="mx-auto mb-2 h-6 w-6 text-primary" />
              <p className="text-lg font-bold">{stmt.title}</p>
              <p className="text-sm text-muted-foreground">{active?.company.name} · VÖEN {active?.company.taxId || '—'} · {stmt.periodLabel} · {base}
                {type === 'profit_loss' && departmentId && (departments ?? []).find((d) => d.id === departmentId) && <> · <span className="text-primary">{(departments ?? []).find((d) => d.id === departmentId)!.name.az}</span></>}
              </p>
            </div>

            {stmt.balanced !== undefined && (
              <div className={cn('flex items-center gap-2 px-5 py-2 text-sm font-medium', stmt.balanced ? 'text-success' : 'text-danger')}>
                {stmt.balanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {stmt.balanced ? 'Balans tənliyi doğrulandı (Aktivlər = Kapital + Öhdəliklər)' : stmt.warning}
              </div>
            )}
            {stmt.warning && stmt.balanced === undefined && (
              <div className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-danger"><AlertTriangle className="h-4 w-4" /> {stmt.warning}</div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2 text-left">Maddə</th>
                    <th className="px-5 py-2 text-right">Cari ({year})</th>
                    {showComparison && <th className="px-5 py-2 text-right">Əvvəlki ({year - 1})</th>}
                  </tr>
                </thead>
                <tbody>
                  {stmt.rows.map((r, i) => {
                    const isHeader = r.current === 0 && r.prior === 0 && r.bold && !r.subtotal;
                    return (
                      <tr key={i} className={cn('border-b border-border/30', r.subtotal && 'border-t border-border bg-secondary/30')}>
                        <td className={cn('px-5 py-1.5', r.bold && 'font-bold', r.level > 0 && 'pl-10')}>{r.label}</td>
                        <td className={cn('px-5 py-1.5 text-right tnum', r.bold && 'font-bold')}>{isHeader ? '' : formatCurrency(r.current, base)}</td>
                        {showComparison && <td className={cn('px-5 py-1.5 text-right tnum text-muted-foreground', r.bold && 'font-bold')}>{isHeader ? '' : formatCurrency(r.prior, base)}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-5 py-3 text-xs text-muted-foreground">Qeyd: Cash Flow (dolayı metod) və Kapital dəyişiklikləri dövr açılış/bağlanış qalıqlarından hesablanır. Hesabat şablonu kod dəyişikliyi olmadan fərdiləşdirilə bilər (09 §9).</p>
          </CardContent>
        </Card>
      )}

      {tplOpen && stmt && TEMPLATABLE.has(type) && (
        <TemplateDialog companyId={companyId} statementType={type as FinancialStatementTemplate['statementType']} rows={stmt.rows.map((r) => r.label)} tpl={tpl}
          actorUid={profile?.uid ?? ''} onClose={() => setTplOpen(false)} onSaved={() => qc.invalidateQueries({ queryKey: ['stmtTpl', companyId, type] })} />
      )}
    </div>
  );
}

function TemplateDialog({ companyId, statementType, rows, tpl, actorUid, onClose, onSaved }: {
  companyId: string; statementType: FinancialStatementTemplate['statementType']; rows: string[]; tpl: FinancialStatementTemplate | null | undefined;
  actorUid: string; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(tpl?.titleOverride ?? '');
  const [comparative, setComparative] = useState(tpl?.showComparative ?? true);
  const [hidden, setHidden] = useState<Set<string>>(new Set(tpl?.hidden ?? []));
  const [renames, setRenames] = useState<Record<string, string>>(tpl?.renames ?? {});
  const [busy, setBusy] = useState(false);
  // Orijinal etiketləri renames tərsindən bərpa etmək çətindir; sadəlik üçün cari (tətbiq edilmiş) etiketlərlə işləyirik

  async function save() {
    setBusy(true);
    try {
      const cleanRenames = Object.fromEntries(Object.entries(renames).filter(([k, v]) => v.trim() && v.trim() !== k));
      await saveStatementTemplate(companyId, statementType, {
        titleOverride: title.trim() || null, showComparative: comparative,
        hidden: Array.from(hidden), renames: cleanRenames,
      }, actorUid);
      toast.success('Şablon saxlanıldı');
      onSaved(); onClose();
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-primary" /> Hesabat şablonu</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Başlıq (override)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Boş = defolt başlıq" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={comparative} onChange={(e) => setComparative(e.target.checked)} className="h-4 w-4 rounded border-input" /> Müqayisəli dövr göstərilsin</label>
          <div>
            <Label className="mb-2 block">Sətirlər — gizlət / adını dəyiş</Label>
            <div className="space-y-1.5">
              {rows.map((label) => (
                <div key={label} className="flex items-center gap-2">
                  <input type="checkbox" title="Gizlət" checked={!hidden.has(label)} onChange={(e) => setHidden((s) => { const n = new Set(s); if (e.target.checked) n.delete(label); else n.add(label); return n; })} className="h-4 w-4 shrink-0 rounded border-input" />
                  <Input value={renames[label] ?? ''} onChange={(e) => setRenames((r) => ({ ...r, [label]: e.target.value }))} placeholder={label} className={cn('h-8 text-xs', hidden.has(label) && 'opacity-40')} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Yadda saxla</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
