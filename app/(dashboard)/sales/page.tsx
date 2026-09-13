'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { InvoicesTab } from './invoices-tab';
import { CustomersTab } from './customers-tab';
import { QuotesOrdersTab } from './quotes-orders-tab';
import { AgingTab } from './aging-tab';

export default function SalesPage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('sales.invoice.view') || can('sales.customer.view');
  const canCreate = isSuperAdmin || can('sales.invoice.create');
  const base = active?.company.baseCurrency ?? 'AZN';

  if (!companyId) return <div><PageHeader title="Satış və Faktura" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Aktiv şirkət seçin.</CardContent></Card></div>;
  if (!canView) return <div><PageHeader title="Satış və Faktura" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">İcazə yoxdur.</CardContent></Card></div>;

  return (
    <div>
      <PageHeader title="Satış və Faktura" subtitle={`${active?.company.name} · quote-to-cash (Modul 6)`} />
      <Tabs defaultValue="invoices">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="invoices">Fakturalar</TabsTrigger>
          <TabsTrigger value="customers">Müştərilər</TabsTrigger>
          <TabsTrigger value="chain">Təklif / Sifariş</TabsTrigger>
          <TabsTrigger value="aging">Debitor yaş analizi</TabsTrigger>
        </TabsList>
        <TabsContent value="invoices"><InvoicesTab companyId={companyId} canCreate={canCreate} actorUid={profile?.uid ?? ''} baseCurrency={base} company={active!.company} /></TabsContent>
        <TabsContent value="customers"><CustomersTab companyId={companyId} canCreate={canCreate} actorUid={profile?.uid ?? ''} baseCurrency={base} /></TabsContent>
        <TabsContent value="chain"><QuotesOrdersTab companyId={companyId} canCreate={canCreate} actorUid={profile?.uid ?? ''} baseCurrency={base} /></TabsContent>
        <TabsContent value="aging"><AgingTab companyId={companyId} baseCurrency={base} /></TabsContent>
      </Tabs>
    </div>
  );
}
