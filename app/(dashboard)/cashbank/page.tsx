'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AccountsTab } from './accounts-tab';
import { PaymentsTab } from './payments-tab';
import { PurchasesTab } from './purchases-tab';
import { CashbookTab } from './cashbook-tab';
import { CurrencyTab } from './currency-tab';
import { ReconcileTab } from './reconcile-tab';
import { BulkTab } from './bulk-tab';
import { ClosingsTab } from './closings-tab';

export default function CashBankPage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('cashbank.transaction.view');
  const canCreate = isSuperAdmin || can('cashbank.transaction.create');
  const base = active?.company.baseCurrency ?? 'AZN';

  if (!companyId) return <div><PageHeader title="Kassa və Bank" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Aktiv şirkət seçin.</CardContent></Card></div>;
  if (!canView) return <div><PageHeader title="Kassa və Bank" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">İcazə yoxdur.</CardContent></Card></div>;

  const props = { companyId, canCreate, actorUid: profile?.uid ?? '', baseCurrency: base };

  return (
    <div>
      <PageHeader title="Kassa və Bank" subtitle={`${active?.company.name} · xəzinədarlıq (Modul 7)`} />
      <Tabs defaultValue="accounts">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="accounts">Hesablar və xəzinə</TabsTrigger>
          <TabsTrigger value="payments">Ödənişlər</TabsTrigger>
          <TabsTrigger value="purchases">Təchizat / Kreditor</TabsTrigger>
          <TabsTrigger value="bulk">Toplu ödəniş</TabsTrigger>
          <TabsTrigger value="reconcile">Uzlaşdırma</TabsTrigger>
          <TabsTrigger value="currency">Valyuta / FX</TabsTrigger>
          <TabsTrigger value="cashbook">Kassa kitabı</TabsTrigger>
          <TabsTrigger value="closings">Gündəlik bağlanış</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts"><AccountsTab {...props} /></TabsContent>
        <TabsContent value="payments"><PaymentsTab {...props} /></TabsContent>
        <TabsContent value="purchases"><PurchasesTab {...props} /></TabsContent>
        <TabsContent value="bulk"><BulkTab {...props} /></TabsContent>
        <TabsContent value="reconcile"><ReconcileTab {...props} /></TabsContent>
        <TabsContent value="currency"><CurrencyTab {...props} /></TabsContent>
        <TabsContent value="cashbook"><CashbookTab {...props} /></TabsContent>
        <TabsContent value="closings"><ClosingsTab {...props} /></TabsContent>
      </Tabs>
    </div>
  );
}
