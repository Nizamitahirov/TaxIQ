'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2, AlertTriangle, FileBarChart, Building2, SlidersHorizontal, Save, BookText } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
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
const TYPES: { value: StatementType; label: string; en: string }[] = [
  { value: 'balance_sheet', label: 'Maliyyə Vəziyyəti (Balans)', en: 'Statement of Financial Position (Balance Sheet)' },
  { value: 'profit_loss', label: 'Mənfəət və Zərər', en: 'Profit & Loss' },
  { value: 'cash_flow', label: 'Pul Vəsaitlərinin Hərəkəti', en: 'Cash Flow Statement' },
  { value: 'equity_changes', label: 'Kapitalda Dəyişikliklər', en: 'Changes in Equity' },
  { value: 'fixed_asset_schedule', label: 'Əsas Vəsaitlərin Hərəkəti', en: 'Fixed Asset Movement' },
  { value: 'accounting_policies', label: 'Uçot Siyasəti və Qeydlər', en: 'Accounting Policies & Notes' },
];
const TEMPLATABLE = new Set<StatementType>(['balance_sheet', 'profit_loss', 'cash_flow', 'equity_changes', 'fixed_asset_schedule']);

export default function IfrsPage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const tt = useTT();
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

  if (!companyId) return <div><PageHeader title={tt('IFRS Hesabatlar', 'IFRS Reports')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('Aktiv şirkət seçin.', 'Select an active company.')}</CardContent></Card></div>;
  if (!allowed) return <div><PageHeader title={tt('IFRS Hesabatlar', 'IFRS Reports')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('İcazə yoxdur (accounting.reports.ifrs.view).', 'No permission (accounting.reports.ifrs.view).')}</CardContent></Card></div>;

  const base = active?.company.baseCurrency ?? 'AZN';
  const isNotes = type === 'accounting_policies';
  const stmt = !isNotes ? (data as FinancialStatement | undefined) : undefined;
  const notes = isNotes ? (data as NotesDocument | undefined) : undefined;
  const showComparison = (type === 'balance_sheet' || type === 'profit_loss') && (tpl?.showComparative ?? true);

  return (
    <div>
      <PageHeader
        title={tt('IFRS Maliyyə Hesabatları', 'IFRS Financial Statements')}
        subtitle={`${active?.company.name} · IAS 1 (${tt('Modul 9', 'Module 9')}) · ${tt('Modul 8 qalıqlarından avtomatik', 'automatic from Module 8 balances')}`}
        action={stmt && (
          <div className="flex gap-2">
            {canManage && TEMPLATABLE.has(type) && <Button variant="outline" size="sm" onClick={() => setTplOpen(true)}><SlidersHorizontal className="h-4 w-4" /> {tt('Şablon', 'Template')}</Button>}
            <ExportButton filename={`ifrs-${type}-${year}`} rows={stmt.rows}
              columns={[
                { header: tt('Maddə', 'Item'), value: 'label' },
                { header: `${tt('Cari', 'Current')} (${year})`, value: 'current' },
                ...(showComparison ? [{ header: `${tt('Əvvəlki', 'Prior')} (${year - 1})`, value: 'prior' as const }] : []),
              ]} />
          </div>
        )}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={type} onValueChange={(v) => setType(v as StatementType)}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{tt(t.label, t.en)}</SelectItem>)}</SelectContent>
        </Select>
        {!isNotes && (
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{[0, 1, 2, 3].map((i) => <SelectItem key={i} value={String(nowYear - i)}>{nowYear - i}</SelectItem>)}</SelectContent>
          </Select>
        )}
        {type === 'profit_loss' && (departments ?? []).length > 0 && (
          <Select value={departmentId || 'all'} onValueChange={(v) => setDepartmentId(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-56"><Building2 className="mr-1 h-4 w-4 text-muted-foreground" /><SelectValue placeholder={tt('Bütün şöbələr', 'All departments')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tt('Bütün şöbələr (konsolidə)', 'All departments (consolidated)')}</SelectItem>
              {(departments ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{tt(d.name.az, d.name.en)}</SelectItem>)}
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
          <p className="border-t border-border px-6 py-3 text-xs text-muted-foreground">{tt('Bu bölmə Fayl 5 (ehtiyat metodu) və Fayl 8 (amortizasiya metodu) seçimlərinə avtomatik istinad edir — əl ilə uyğunsuzluq riski aradan qalxır (09 §7).', 'This section automatically references the Module 5 (inventory method) and Module 8 (depreciation method) selections — the risk of manual inconsistency is eliminated (09 §7).')}</p>
        </CardContent></Card>
      ) : stmt && (
        <Card className="rounded-card">
          <CardContent className="p-0">
            <div className="border-b border-border p-5 text-center">
              <FileBarChart className="mx-auto mb-2 h-6 w-6 text-primary" />
              <p className="text-lg font-bold">{stmt.title}</p>
              <p className="text-sm text-muted-foreground">{active?.company.name} · VÖEN {active?.company.taxId || '—'} · {stmt.periodLabel} · {base}
                {type === 'profit_loss' && departmentId && (departments ?? []).find((d) => d.id === departmentId) && <> · <span className="text-primary">{tt((departments ?? []).find((d) => d.id === departmentId)!.name.az, (departments ?? []).find((d) => d.id === departmentId)!.name.en)}</span></>}
              </p>
            </div>

            {stmt.balanced !== undefined && (
              <div className={cn('flex items-center gap-2 px-5 py-2 text-sm font-medium', stmt.balanced ? 'text-success' : 'text-danger')}>
                {stmt.balanced ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                {stmt.balanced ? tt('Balans tənliyi doğrulandı (Aktivlər = Kapital + Öhdəliklər)', 'Balance equation verified (Assets = Equity + Liabilities)') : stmt.warning}
              </div>
            )}
            {stmt.warning && stmt.balanced === undefined && (
              <div className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-danger"><AlertTriangle className="h-4 w-4" /> {stmt.warning}</div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2 text-left">{tt('Maddə', 'Item')}</th>
                    <th className="px-5 py-2 text-right">{tt('Cari', 'Current')} ({year})</th>
                    {showComparison && <th className="px-5 py-2 text-right">{tt('Əvvəlki', 'Prior')} ({year - 1})</th>}
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
            <p className="px-5 py-3 text-xs text-muted-foreground">{tt('Qeyd: Cash Flow (dolayı metod) və Kapital dəyişiklikləri dövr açılış/bağlanış qalıqlarından hesablanır. Hesabat şablonu kod dəyişikliyi olmadan fərdiləşdirilə bilər (09 §9).', 'Note: Cash Flow (indirect method) and Changes in Equity are calculated from period opening/closing balances. The statement template can be customized without code changes (09 §9).')}</p>
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
  const tt = useTT();
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
      toast.success(tt('Şablon saxlanıldı', 'Template saved'));
      onSaved(); onClose();
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5 text-primary" /> {tt('Hesabat şablonu', 'Statement template')}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>{tt('Başlıq (override)', 'Title (override)')}</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tt('Boş = defolt başlıq', 'Empty = default title')} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={comparative} onChange={(e) => setComparative(e.target.checked)} className="h-4 w-4 rounded border-input" /> {tt('Müqayisəli dövr göstərilsin', 'Show comparative period')}</label>
          <div>
            <Label className="mb-2 block">{tt('Sətirlər — gizlət / adını dəyiş', 'Rows — hide / rename')}</Label>
            <div className="space-y-1.5">
              {rows.map((label) => (
                <div key={label} className="flex items-center gap-2">
                  <input type="checkbox" title={tt('Gizlət', 'Hide')} checked={!hidden.has(label)} onChange={(e) => setHidden((s) => { const n = new Set(s); if (e.target.checked) n.delete(label); else n.add(label); return n; })} className="h-4 w-4 shrink-0 rounded border-input" />
                  <Input value={renames[label] ?? ''} onChange={(e) => setRenames((r) => ({ ...r, [label]: e.target.value }))} placeholder={label} className={cn('h-8 text-xs', hidden.has(label) && 'opacity-40')} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {tt('Yadda saxla', 'Save')}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
