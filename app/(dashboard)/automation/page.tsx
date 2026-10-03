'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RefreshCw, Repeat, AlertTriangle, FileSpreadsheet, Sparkles, Loader2, Check, ArrowRight, Info } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { generateDueRecurringInvoices, refreshOverdue } from '@/lib/firebase/sales';
import { listAccounts, runDepreciation } from '@/lib/firebase/accounting';
import { runAmortization } from '@/lib/firebase/intangibles';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { formatCurrency } from '@/lib/utils/format';
import type { LucideIcon } from 'lucide-react';

interface JobResult { text: string; ok: boolean }

export default function AutomationPage() {
  const tt = useTT();
  const { active, isSuperAdmin, can, profile } = useAuth();
  const companyId = active?.companyId;
  const cur = active?.company.baseCurrency ?? 'AZN';
  const canRun = isSuperAdmin || can('accounting.journal.create') || can('sales.invoice.create');
  const uid = profile?.uid ?? '';
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, JobResult>>({});

  async function run(key: string, fn: () => Promise<JobResult>) {
    setBusy(key);
    try { const r = await fn(); setResults((s) => ({ ...s, [key]: r })); if (r.ok) toast.success(tt('İcra olundu', 'Done'), r.text); else toast.info(r.text); }
    catch (e) { const msg = e instanceof Error ? e.message : String(e); setResults((s) => ({ ...s, [key]: { text: msg, ok: false } })); toast.error(tt('Xəta', 'Error'), msg); }
    finally { setBusy(null); }
  }

  const jobs: { key: string; icon: LucideIcon; title: [string, string]; desc: [string, string]; run: () => Promise<JobResult> }[] = [
    {
      key: 'recurring', icon: Repeat, title: ['Təkrarlanan fakturalar', 'Recurring invoices'],
      desc: ['Vaxtı çatmış təkrarlanan şablonlardan fakturalar yaradır', 'Generates invoices from due recurring templates'],
      run: async () => { const n = await generateDueRecurringInvoices(companyId!, uid); return { ok: n > 0, text: tt(`${n} faktura yaradıldı`, `${n} invoice(s) created`) }; },
    },
    {
      key: 'overdue', icon: AlertTriangle, title: ['Gecikmiş borclar', 'Overdue refresh'],
      desc: ['Ödəmə tarixi keçmiş fakturaları «gecikmiş» kimi işarələyir', 'Marks past-due invoices as overdue'],
      run: async () => { const n = await refreshOverdue(companyId!); return { ok: n > 0, text: tt(`${n} faktura yeniləndi`, `${n} invoice(s) updated`) }; },
    },
    {
      key: 'depreciation', icon: FileSpreadsheet, title: ['Aylıq amortizasiya (əsas vəsait)', 'Monthly depreciation (fixed assets)'],
      desc: ['Əsas vəsaitlər üzrə aylıq köhnəlmə jurnalı (Dt 721 / Kt 112)', 'Monthly fixed-asset depreciation entry (Dr 721 / Cr 112)'],
      run: async () => {
        const accounts = await listAccounts(companyId!);
        const exp = accounts.find((a) => a.accountCode === '721'), accum = accounts.find((a) => a.accountCode === '112');
        if (!exp || !accum) return { ok: false, text: tt('721/112 hesabları tapılmadı — Hesablar Planını qurun', '721/112 accounts not found — set up the chart of accounts') };
        const { total } = await runDepreciation(companyId!, uid, exp.id, accum.id);
        return { ok: total > 0, text: total > 0 ? tt(`Cəmi ${formatCurrency(total, cur)} amortizasiya`, `${formatCurrency(total, cur)} depreciation posted`) : tt('Amortizasiya üçün aktiv yoxdur', 'Nothing to depreciate') };
      },
    },
    {
      key: 'depreciation-micro', icon: FileSpreadsheet, title: ['Aylıq amortizasiya — mikro sahibkar (×2)', 'Monthly depreciation — micro business (×2)'],
      desc: ['Mikro sahibkar üçün azalan qalıq norması ×2 (Vergi Məcəlləsi m.114.3-2)', 'Reducing-balance rate ×2 for micro businesses (Tax Code Art.114.3-2)'],
      run: async () => {
        const accounts = await listAccounts(companyId!);
        const exp = accounts.find((a) => a.accountCode === '721'), accum = accounts.find((a) => a.accountCode === '112');
        if (!exp || !accum) return { ok: false, text: tt('721/112 hesabları tapılmadı — Hesablar Planını qurun', '721/112 accounts not found — set up the chart of accounts') };
        const { total } = await runDepreciation(companyId!, uid, exp.id, accum.id, true);
        return { ok: total > 0, text: total > 0 ? tt(`Cəmi ${formatCurrency(total, cur)} amortizasiya (×2)`, `${formatCurrency(total, cur)} depreciation (×2) posted`) : tt('Amortizasiya üçün aktiv yoxdur', 'Nothing to depreciate') };
      },
    },
    {
      key: 'amortization', icon: Sparkles, title: ['Aylıq amortizasiya (qeyri-maddi)', 'Monthly amortization (intangibles)'],
      desc: ['Qeyri-maddi aktivlər üzrə aylıq amortizasiya (Dt 721 / Kt 101)', 'Monthly intangible-asset amortization (Dr 721 / Cr 101)'],
      run: async () => {
        const { total } = await runAmortization(companyId!, uid);
        return { ok: total > 0, text: total > 0 ? tt(`Cəmi ${formatCurrency(total, cur)} amortizasiya`, `${formatCurrency(total, cur)} amortization posted`) : tt('Amortizasiya üçün aktiv yoxdur', 'Nothing to amortize') };
      },
    },
  ];

  if (!companyId) return <div><PageHeader title={tt('Dövri əməliyyatlar', 'Periodic operations')} /><EmptyState title={tt('Aktiv şirkət seçin', 'Select an active company')} /></div>;
  if (!canRun) return <div><PageHeader title={tt('Dövri əməliyyatlar', 'Periodic operations')} /><EmptyState title={tt('İcazə yoxdur', 'No permission')} /></div>;

  return (
    <div>
      <PageHeader title={tt('Dövri əməliyyatlar', 'Periodic operations')} subtitle={tt('Dövri (aylıq) işləri bir yerdən icra edin — ay bağlanışı üçün', 'Run recurring (monthly) jobs from one place — for month-end')} />

      <div className="mb-4 flex items-start gap-2 rounded-card border border-info/20 bg-info/5 p-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        {tt('Bu işlər əl ilə icra olunur. Tam avtomatik cədvəl (hər ayın 1-i və s.) Firebase Cloud Functions (Blaze planı) tələb edir — kod hazırdır, deploy müştəri mühitindədir.', 'These jobs run manually. Fully automatic scheduling (e.g. on the 1st of each month) requires Firebase Cloud Functions (Blaze plan) — the code is ready, deployment is done in your environment.')}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {jobs.map((j) => {
          const r = results[j.key];
          return (
            <Card key={j.key} className="rounded-card"><CardContent className="flex flex-col gap-3 p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><j.icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{tt(j.title[0], j.title[1])}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{tt(j.desc[0], j.desc[1])}</p>
                </div>
              </div>
              {r && <div className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs ${r.ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-secondary text-muted-foreground'}`}>{r.ok ? <Check className="h-3.5 w-3.5" /> : <Info className="h-3.5 w-3.5" />} {r.text}</div>}
              <Button variant="outline" className="self-start" disabled={busy === j.key} onClick={() => run(j.key, j.run)}>
                {busy === j.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {tt('İcra et', 'Run')}
              </Button>
            </CardContent></Card>
          );
        })}

        <Card className="rounded-card"><CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><RefreshCw className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{tt('Valyuta yenidən qiymətləndirmə (FX)', 'FX revaluation')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{tt('Dövr sonu açıq valyuta qalıqlarının yenidən qiymətləndirilməsi məzənnə tələb edir', 'Period-end revaluation of open FX balances needs exchange rates')}</p>
            </div>
          </div>
          <Link href="/cashbank" className="self-start"><Button variant="outline"><ArrowRight className="h-4 w-4" /> {tt('Kassa/Bank → Valyuta/FX', 'Cash/Bank → FX')}</Button></Link>
        </CardContent></Card>
      </div>
    </div>
  );
}
