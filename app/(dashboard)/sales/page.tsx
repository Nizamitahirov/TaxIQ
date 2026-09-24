'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { InvoicesTab } from './invoices-tab';
import { CustomersTab } from './customers-tab';
import { QuotesOrdersTab } from './quotes-orders-tab';
import { AgingTab } from './aging-tab';
import { RecurringTab } from './recurring-tab';
import { TemplatesTab } from './templates-tab';

export default function SalesPage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const tt = useTT();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('sales.invoice.view') || can('sales.customer.view');
  const canCreate = isSuperAdmin || can('sales.invoice.create');
  const base = active?.company.baseCurrency ?? 'AZN';

  if (!companyId) return <div><PageHeader title={tt('Satış və Faktura', 'Sales & Invoicing')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('Aktiv şirkət seçin.', 'Select an active company.')}</CardContent></Card></div>;
  if (!canView) return <div><PageHeader title={tt('Satış və Faktura', 'Sales & Invoicing')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('İcazə yoxdur.', 'No permission.')}</CardContent></Card></div>;

  return (
    <div>
      <PageHeader title={tt('Satış və Faktura', 'Sales & Invoicing')} subtitle={`${active?.company.name} · quote-to-cash (${tt('Modul 6', 'Module 6')})`} />
      <Tabs defaultValue="invoices">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="invoices">{tt('Fakturalar', 'Invoices')}</TabsTrigger>
          <TabsTrigger value="customers">{tt('Müştərilər', 'Customers')}</TabsTrigger>
          <TabsTrigger value="chain">{tt('Təklif / Sifariş', 'Quote / Order')}</TabsTrigger>
          <TabsTrigger value="recurring">{tt('Təkrarlanan', 'Recurring')}</TabsTrigger>
          <TabsTrigger value="templates">{tt('Şablonlar', 'Templates')}</TabsTrigger>
          <TabsTrigger value="aging">{tt('Debitor yaş analizi', 'AR aging')}</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices"><InvoicesTab companyId={companyId} canCreate={canCreate} actorUid={profile?.uid ?? ''} baseCurrency={base} company={active!.company} /></TabsContent>
        <TabsContent value="customers"><CustomersTab companyId={companyId} canCreate={canCreate} actorUid={profile?.uid ?? ''} baseCurrency={base} /></TabsContent>
        <TabsContent value="chain"><QuotesOrdersTab companyId={companyId} canCreate={canCreate} actorUid={profile?.uid ?? ''} baseCurrency={base} /></TabsContent>
        <TabsContent value="recurring"><RecurringTab companyId={companyId} canCreate={canCreate} actorUid={profile?.uid ?? ''} baseCurrency={base} /></TabsContent>
        <TabsContent value="templates"><TemplatesTab companyId={companyId} canCreate={canCreate} actorUid={profile?.uid ?? ''} /></TabsContent>
        <TabsContent value="aging"><AgingTab companyId={companyId} baseCurrency={base} /></TabsContent>
      </Tabs>
    </div>
  );
}
