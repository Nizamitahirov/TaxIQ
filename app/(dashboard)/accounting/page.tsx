'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, BookOpen, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listAccounts, initializeChartOfAccounts } from '@/lib/firebase/accounting';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from '@/components/ui/toast';
import { useState } from 'react';
import { CoaTab } from './coa-tab';
import { JournalTab } from './journal-tab';
import { TrialBalanceTab } from './trial-balance-tab';
import { PeriodsTab } from './periods-tab';
import { FixedAssetsTab } from './fixed-assets-tab';
import { PostingRulesTab } from './posting-rules-tab';

export default function AccountingPage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const tt = useTT();
  const qc = useQueryClient();
  const [initializing, setInitializing] = useState(false);
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('accounting.journal.view') || can('accounting.coa.view');

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['coa', companyId],
    queryFn: () => listAccounts(companyId!),
    enabled: !!companyId && canView,
  });

  if (!companyId) return <div><PageHeader title={tt('Mühasibat', 'Accounting')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('Aktiv şirkət seçin.', 'Select an active company.')}</CardContent></Card></div>;
  if (!canView) return <div><PageHeader title={tt('Mühasibat', 'Accounting')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('İcazə yoxdur.', 'No permission.')}</CardContent></Card></div>;

  async function initialize() {
    setInitializing(true);
    try {
      const n = await initializeChartOfAccounts(companyId!, profile?.uid ?? '');
      toast.success(tt('Hesablar Planı quruldu', 'Chart of accounts created'), `${n} ${tt('hesab əlavə edildi', 'accounts added')}`);
      qc.invalidateQueries({ queryKey: ['coa', companyId] });
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setInitializing(false); }
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (!accounts || accounts.length === 0) {
    return (
      <div>
        <PageHeader title={tt('Mühasibat', 'Accounting')} subtitle={tt('Hesablar Planı, jurnal, yoxlama balansı (Modul 8)', 'Chart of accounts, journal, trial balance (Module 8)')} />
        <Card className="rounded-card"><CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BookOpen className="h-8 w-8" /></span>
          <div>
            <p className="text-lg font-semibold">{tt('Hesablar Planı qurulmayıb', 'Chart of accounts not set up')}</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{tt('Azərbaycan MMUS/IFRS rəsmi Hesablar Planını bu şirkət üçün avtomatik qurun (08 §1).', 'Automatically set up the official Azerbaijani NAS/IFRS chart of accounts for this company (08 §1).')}</p>
          </div>
          <Button onClick={initialize} disabled={initializing}>{initializing ? <Loader2 className="animate-spin" /> : <Sparkles className="h-4 w-4" />} {tt('Hesablar Planını qur', 'Set up chart of accounts')}</Button>
        </CardContent></Card>
      </div>
    );
  }

  const canPost = isSuperAdmin || can('accounting.journal.create');

  return (
    <div>
      <PageHeader title={tt('Mühasibat', 'Accounting')} subtitle={`${active?.company.name} · ${accounts.length} ${tt('hesab', 'accounts')}`} />
      <Tabs defaultValue="coa">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="coa">{tt('Hesablar Planı', 'Chart of Accounts')}</TabsTrigger>
          <TabsTrigger value="journal">{tt('Əməliyyat Jurnalı', 'Journal')}</TabsTrigger>
          <TabsTrigger value="trial">{tt('Yoxlama Balansı', 'Trial Balance')}</TabsTrigger>
          <TabsTrigger value="periods">{tt('Dövrlər', 'Periods')}</TabsTrigger>
          <TabsTrigger value="assets">{tt('Əsas Vəsaitlər', 'Fixed Assets')}</TabsTrigger>
          <TabsTrigger value="posting">{tt('Posting Qaydaları', 'Posting Rules')}</TabsTrigger>
        </TabsList>
        <TabsContent value="coa"><CoaTab companyId={companyId} accounts={accounts} canEdit={isSuperAdmin || can('accounting.coa.edit')} actorUid={profile?.uid ?? ''} /></TabsContent>
        <TabsContent value="journal"><JournalTab companyId={companyId} accounts={accounts} canPost={canPost} actorUid={profile?.uid ?? ''} baseCurrency={active?.company.baseCurrency ?? 'AZN'} /></TabsContent>
        <TabsContent value="trial"><TrialBalanceTab companyId={companyId} /></TabsContent>
        <TabsContent value="periods"><PeriodsTab companyId={companyId} canManage={isSuperAdmin || can('accounting.journal.approve')} actorUid={profile?.uid ?? ''} /></TabsContent>
        <TabsContent value="assets"><FixedAssetsTab companyId={companyId} accounts={accounts} canManage={canPost} actorUid={profile?.uid ?? ''} /></TabsContent>
        <TabsContent value="posting"><PostingRulesTab companyId={companyId} accounts={accounts} canManage={isSuperAdmin || can('accounting.posting_rules.manage')} actorUid={profile?.uid ?? ''} /></TabsContent>
      </Tabs>
    </div>
  );
}
