'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
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
  const tt = useTT();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('cashbank.transaction.view');
  const canCreate = isSuperAdmin || can('cashbank.transaction.create');
  const base = active?.company.baseCurrency ?? 'AZN';

  if (!companyId) return <div><PageHeader title={tt('Kassa və Bank', 'Cash & Bank')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('Aktiv şirkət seçin.', 'Select an active company.')}</CardContent></Card></div>;
  if (!canView) return <div><PageHeader title={tt('Kassa və Bank', 'Cash & Bank')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('İcazə yoxdur.', 'No permission.')}</CardContent></Card></div>;

  const props = { companyId, canCreate, actorUid: profile?.uid ?? '', baseCurrency: base };

  return (
    <div>
      <PageHeader title={tt('Kassa və Bank', 'Cash & Bank')} subtitle={`${active?.company.name} · ${tt('xəzinədarlıq (Modul 7)', 'treasury (Module 7)')}`} />
      <Tabs defaultValue="accounts">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="accounts">{tt('Hesablar və xəzinə', 'Accounts & treasury')}</TabsTrigger>
          <TabsTrigger value="payments">{tt('Ödənişlər', 'Payments')}</TabsTrigger>
          <TabsTrigger value="purchases">{tt('Təchizat / Kreditor', 'Purchases / Payables')}</TabsTrigger>
          <TabsTrigger value="bulk">{tt('Toplu ödəniş', 'Bulk payment')}</TabsTrigger>
          <TabsTrigger value="reconcile">{tt('Uzlaşdırma', 'Reconciliation')}</TabsTrigger>
          <TabsTrigger value="currency">{tt('Valyuta / FX', 'Currency / FX')}</TabsTrigger>
          <TabsTrigger value="cashbook">{tt('Kassa kitabı', 'Cash book')}</TabsTrigger>
          <TabsTrigger value="closings">{tt('Gündəlik bağlanış', 'Daily closing')}</TabsTrigger>
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
