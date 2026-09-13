'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, BookOpen, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
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

export default function AccountingPage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const qc = useQueryClient();
  const [initializing, setInitializing] = useState(false);
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('accounting.journal.view') || can('accounting.coa.view');

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['coa', companyId],
    queryFn: () => listAccounts(companyId!),
    enabled: !!companyId && canView,
  });

  if (!companyId) return <div><PageHeader title="Mühasibat" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Aktiv şirkət seçin.</CardContent></Card></div>;
  if (!canView) return <div><PageHeader title="Mühasibat" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">İcazə yoxdur.</CardContent></Card></div>;

  async function initialize() {
    setInitializing(true);
    try {
      const n = await initializeChartOfAccounts(companyId!, profile?.uid ?? '');
      toast.success('Hesablar Planı quruldu', `${n} hesab əlavə edildi`);
      qc.invalidateQueries({ queryKey: ['coa', companyId] });
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
    finally { setInitializing(false); }
  }

  if (isLoading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (!accounts || accounts.length === 0) {
    return (
      <div>
        <PageHeader title="Mühasibat" subtitle="Hesablar Planı, jurnal, yoxlama balansı (Modul 8)" />
        <Card className="rounded-card"><CardContent className="flex flex-col items-center gap-4 py-16 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BookOpen className="h-8 w-8" /></span>
          <div>
            <p className="text-lg font-semibold">Hesablar Planı qurulmayıb</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Azərbaycan MMUS/IFRS rəsmi Hesablar Planını bu şirkət üçün avtomatik qurun (08 §1).</p>
          </div>
          <Button onClick={initialize} disabled={initializing}>{initializing ? <Loader2 className="animate-spin" /> : <Sparkles className="h-4 w-4" />} Hesablar Planını qur</Button>
        </CardContent></Card>
      </div>
    );
  }

  const canPost = isSuperAdmin || can('accounting.journal.create');

  return (
    <div>
      <PageHeader title="Mühasibat" subtitle={`${active?.company.name} · ${accounts.length} hesab`} />
      <Tabs defaultValue="coa">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="coa">Hesablar Planı</TabsTrigger>
          <TabsTrigger value="journal">Əməliyyat Jurnalı</TabsTrigger>
          <TabsTrigger value="trial">Yoxlama Balansı</TabsTrigger>
          <TabsTrigger value="periods">Dövrlər</TabsTrigger>
          <TabsTrigger value="assets">Əsas Vəsaitlər</TabsTrigger>
        </TabsList>
        <TabsContent value="coa"><CoaTab companyId={companyId} accounts={accounts} canEdit={isSuperAdmin || can('accounting.coa.edit')} actorUid={profile?.uid ?? ''} /></TabsContent>
        <TabsContent value="journal"><JournalTab companyId={companyId} accounts={accounts} canPost={canPost} actorUid={profile?.uid ?? ''} baseCurrency={active?.company.baseCurrency ?? 'AZN'} /></TabsContent>
        <TabsContent value="trial"><TrialBalanceTab companyId={companyId} /></TabsContent>
        <TabsContent value="periods"><PeriodsTab companyId={companyId} canManage={isSuperAdmin || can('accounting.journal.approve')} actorUid={profile?.uid ?? ''} /></TabsContent>
        <TabsContent value="assets"><FixedAssetsTab companyId={companyId} accounts={accounts} canManage={canPost} actorUid={profile?.uid ?? ''} /></TabsContent>
      </Tabs>
    </div>
  );
}
