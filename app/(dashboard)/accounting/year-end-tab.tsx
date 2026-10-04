'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Lock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { computeTrialBalance, listAccounts, postJournalEntry } from '@/lib/firebase/accounting';
import { computeYearEndClosing } from '@/lib/accounting/year-end';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';
import { formatCurrency } from '@/lib/utils/format';

interface Props { companyId: string; canManage: boolean; actorUid: string; baseCurrency: string }

export function YearEndTab({ companyId, canManage, actorUid, baseCurrency }: Props) {
  const tt = useTT();
  const year = new Date().getFullYear();
  const [posting, setPosting] = useState(false);
  const [done, setDone] = useState<{ closing: string; transfer: string } | null>(null);

  const { data: tb, isLoading } = useQuery({ queryKey: ['trialBalance', companyId], queryFn: () => computeTrialBalance(companyId) });
  const { data: accounts } = useQuery({ queryKey: ['accounts', companyId], queryFn: () => listAccounts(companyId) });

  const plan = useMemo(() => {
    if (!tb || !accounts) return null;
    const s341 = accounts.find((a) => a.accountCode === '341');
    const s344 = accounts.find((a) => a.accountCode === '344');
    return computeYearEndClosing(
      tb.rows.map((r) => ({ accountId: r.accountId, accountCode: r.accountCode, accountName: r.accountName, balance: r.balance, normalBalance: r.normalBalance })),
      { profitSummaryId: s341?.id, profitSummaryName: s341?.accountName.az, retainedId: s344?.id, retainedName: s344?.accountName.az },
    );
  }, [tb, accounts]);

  async function post() {
    if (!plan || !plan.ok) return;
    if (!confirm(tt(`${year} ili bağlansın? Bu, bağlanış jurnal yazılarını yaradacaq.`, `Close ${year}? This will create the closing journal entries.`))) return;
    setPosting(true);
    try {
      const closing = await postJournalEntry({
        companyId, entryDate: `${year}-12-31`, description: `İl bağlanışı ${year} — gəlir/xərc hesablarının bağlanması`,
        sourceType: 'year_end_closing', sourceDocumentId: `yec-${year}`, createdBy: actorUid, baseCurrency,
        lines: plan.closingLines,
      });
      let transfer = '';
      if (plan.transferLines.length >= 2) {
        transfer = await postJournalEntry({
          companyId, entryDate: `${year}-12-31`, description: `İl bağlanışı ${year} — xalis nəticənin 344-ə köçürülməsi`,
          sourceType: 'year_end_closing', sourceDocumentId: `yec-transfer-${year}`, createdBy: actorUid, baseCurrency,
          lines: plan.transferLines,
        });
      }
      setDone({ closing, transfer });
      toast.success(tt('İl bağlanışı post edildi', 'Year-end closing posted'));
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); } finally { setPosting(false); }
  }

  if (isLoading) return <div className="mt-4 flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="mt-4 space-y-4">
      <p className="text-sm text-muted-foreground">{tt('İl bağlanışı — gəlir (sinif 6) və xərc (sinif 7) hesabları 341-ə bağlanır, xalis nəticə 344-ə köçürülür (Mühasibat uçotu Qanunu, dövrün bağlanması).', 'Year-end closing — class 6 (revenue) and class 7 (expense) accounts close to 341, net result transfers to 344.')}</p>

      {plan && !plan.ok && (
        <Card className="rounded-card border-amber-300"><CardContent className="flex items-center gap-2 py-4 text-sm"><AlertTriangle className="h-4 w-4 text-amber-500" /> {plan.message}</CardContent></Card>
      )}

      {plan && plan.ok && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Stat label={tt('Gəlir (sinif 6)', 'Revenue (class 6)')} value={formatCurrency(plan.revenueTotal, baseCurrency)} />
            <Stat label={tt('Xərc (sinif 7)', 'Expense (class 7)')} value={formatCurrency(plan.expenseTotal, baseCurrency)} />
            <Stat label={plan.netProfit >= 0 ? tt('Xalis mənfəət', 'Net profit') : tt('Xalis zərər', 'Net loss')} value={formatCurrency(Math.abs(plan.netProfit), baseCurrency)} tint={plan.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
          </div>

          <Card className="rounded-card">
            <CardHeader><CardTitle className="text-base">{tt('Təklif olunan bağlanış yazıları', 'Proposed closing entries')} <Badge variant="secondary">31.12.{year}</Badge></CardTitle></CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader><TableRow><TableHead>{tt('Hesab', 'Account')}</TableHead><TableHead className="text-right">{tt('Debet', 'Debit')}</TableHead><TableHead className="text-right">{tt('Kredit', 'Credit')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {[...plan.closingLines, ...plan.transferLines].map((l, i) => (
                    <TableRow key={i}>
                      <TableCell><span className="font-mono text-xs text-muted-foreground">{l.accountCode}</span> {l.accountName}</TableCell>
                      <TableCell className="text-right tnum">{l.debit ? formatCurrency(l.debit, baseCurrency) : ''}</TableCell>
                      <TableCell className="text-right tnum">{l.credit ? formatCurrency(l.credit, baseCurrency) : ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {done ? (
            <Card className="rounded-card border-emerald-300"><CardContent className="flex items-center gap-2 py-4 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {tt('İl bağlanışı post edildi. Jurnalda baxın.', 'Year-end closing posted. See the journal.')}</CardContent></Card>
          ) : canManage ? (
            <Button onClick={post} disabled={posting || (plan.revenueTotal === 0 && plan.expenseTotal === 0)}>{posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />} {tt(`${year} ilini bağla`, `Close ${year}`)}</Button>
          ) : (
            <p className="text-xs text-muted-foreground">{tt('Post etmək üçün icazə yoxdur.', 'No permission to post.')}</p>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return <Card className="rounded-card"><CardContent className="p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`text-xl font-bold tnum ${tint ?? ''}`}>{value}</p></CardContent></Card>;
}
