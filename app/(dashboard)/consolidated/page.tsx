'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, GitMerge, Download, Building2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listCompanies } from '@/lib/firebase/companies';
import { consolidate, type ConsolidatedStatement, type ConsolidatedKind } from '@/lib/ifrs/consolidate';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { exportWorkbook } from '@/lib/utils/export';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import type { Company } from '@/types';

export default function ConsolidatedPage() {
  const tt = useTT();
  const { memberships, isSuperAdmin, can, active } = useAuth();
  const cur = active?.company.baseCurrency ?? 'AZN';
  const canView = isSuperAdmin || can('reports.view') || can('accounting.coa.view');
  const nowYear = new Date().getFullYear();

  const [year, setYear] = useState(nowYear);
  const [kind, setKind] = useState<ConsolidatedKind>('pl');
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<ConsolidatedStatement | null>(null);
  const [running, setRunning] = useState(false);

  // Super admin bütün şirkətləri görür; digərləri yalnız üzv olduqları
  const { data: allCompanies } = useQuery({ queryKey: ['allCompanies'], queryFn: listCompanies, enabled: canView && isSuperAdmin });
  const companies: { id: string; name: string }[] = useMemo(() => {
    const src: { id: string; name: string }[] = isSuperAdmin
      ? (allCompanies ?? []).map((c: Company) => ({ id: c.id, name: c.name }))
      : memberships.map((m) => ({ id: m.companyId, name: m.company.name }));
    return src.sort((a, b) => a.name.localeCompare(b.name));
  }, [isSuperAdmin, allCompanies, memberships]);

  const toggle = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  async function run() {
    if (selected.length < 1) return;
    setRunning(true);
    try {
      const cols = selected.map((id) => ({ companyId: id, name: companies.find((c) => c.id === id)?.name ?? id }));
      setResult(await consolidate(cols, year, kind));
    } finally { setRunning(false); }
  }

  function exportXlsx() {
    if (!result) return;
    const headers = [tt('Göstərici', 'Item'), ...result.columns.map((c) => c.name), tt('KONSOLIDƏ', 'CONSOLIDATED')];
    const rows = result.rows.map((r) => [r.label, ...result.columns.map((c) => r.byCompany[c.companyId] ?? 0), r.total]);
    exportWorkbook(`konsolide-${kind}-${year}`, [{ name: result.periodLabel, headers, rows }]);
  }

  const years = Array.from({ length: 5 }, (_, i) => nowYear - i);

  if (!canView) return <div><PageHeader title={tt('Konsolidə hesabatlıq', 'Consolidated reporting')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader title={tt('Konsolidə hesabatlıq', 'Consolidated reporting')} subtitle={tt('Bir neçə şirkətin IFRS hesabatlarını qrup səviyyəsində birləşdirin', 'Combine several companies’ IFRS statements at group level')}
        action={result && <Button variant="outline" onClick={exportXlsx}><Download className="h-4 w-4" /> Excel</Button>} />

      <Card className="mb-4 rounded-card"><CardContent className="space-y-4 p-5">
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">{tt('Şirkətlər', 'Companies')}</p>
          <div className="flex flex-wrap gap-2">
            {companies.length === 0 ? <p className="text-sm text-muted-foreground">{tt('Şirkət tapılmadı', 'No companies')}</p> : companies.map((c) => (
              <button key={c.id} onClick={() => toggle(c.id)}
                className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors', selected.includes(c.id) ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/40')}>
                <Building2 className="h-4 w-4" /> {c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1"><p className="text-xs text-muted-foreground">{tt('Hesabat', 'Statement')}</p>
            <Select value={kind} onValueChange={(v) => setKind(v as ConsolidatedKind)}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="pl">{tt('Mənfəət və Zərər', 'Profit & Loss')}</SelectItem><SelectItem value="balance">{tt('Balans Hesabatı', 'Balance Sheet')}</SelectItem></SelectContent></Select></div>
          <div className="space-y-1"><p className="text-xs text-muted-foreground">{tt('İl', 'Year')}</p>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
          <Button onClick={run} disabled={running || selected.length < 1}>{running ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitMerge className="h-4 w-4" />} {tt('Birləşdir', 'Consolidate')}</Button>
          {selected.length > 0 && <Badge variant="secondary">{tt(`${selected.length} şirkət seçilib`, `${selected.length} selected`)}</Badge>}
        </div>
      </CardContent></Card>

      {result && (
        <Card className="rounded-card"><CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div><h3 className="font-semibold">{result.title}</h3><p className="text-sm text-muted-foreground">{result.periodLabel}</p></div>
            {result.balanced != null && <Badge variant={result.balanced ? 'default' : 'destructive'}>{result.balanced ? tt('Balanslı', 'Balanced') : tt('Balanssız', 'Unbalanced')}</Badge>}
          </div>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b border-border bg-secondary/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-2.5 text-left">{tt('Göstərici', 'Item')}</th>
              {result.columns.map((c) => <th key={c.companyId} className="px-4 py-2.5 text-right">{c.name}</th>)}
              <th className="px-4 py-2.5 text-right text-primary">{tt('KONSOLIDƏ', 'GROUP')}</th>
            </tr></thead>
            <tbody>
              {result.rows.map((r, i) => (
                <tr key={i} className={cn('border-b border-border/50 last:border-0', r.subtotal && 'bg-secondary/30')}>
                  <td className={cn('px-4 py-2', r.bold && 'font-semibold')} style={{ paddingLeft: `${16 + r.level * 16}px` }}>{r.label}</td>
                  {result.columns.map((c) => <td key={c.companyId} className="px-4 py-2 text-right tnum text-muted-foreground">{formatCurrency(r.byCompany[c.companyId] ?? 0, cur)}</td>)}
                  <td className={cn('px-4 py-2 text-right tnum', (r.bold || r.subtotal) && 'font-bold text-primary')}>{formatCurrency(r.total, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </CardContent></Card>
      )}
      {!result && <EmptyState title={tt('Hesabat qurulmayıb', 'No statement yet')} description={tt('Şirkətləri seçin və «Birləşdir» düyməsini basın', 'Select companies and click Consolidate')} />}
      <p className="mt-3 text-xs text-muted-foreground">{tt('Qeyd: şirkətlərarası (intercompany) əməliyyatların eliminasiyası bu versiyada avtomatik deyil.', 'Note: intercompany eliminations are not automated in this version.')}</p>
    </div>
  );
}
