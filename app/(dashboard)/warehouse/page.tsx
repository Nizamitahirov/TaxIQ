'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CatalogTab } from './catalog-tab';
import { StockTab } from './stock-tab';
import { MovementsTab } from './movements-tab';
import { TransfersTab } from './transfers-tab';

export default function WarehousePage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('warehouse.stock.view') || can('warehouse.goods.view');
  const canCreate = isSuperAdmin || can('warehouse.stock.create') || can('warehouse.goods.create');
  const base = active?.company.baseCurrency ?? 'AZN';

  if (!companyId) return <div><PageHeader title="Anbar" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Aktiv şirkət seçin.</CardContent></Card></div>;
  if (!canView) return <div><PageHeader title="Anbar" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">İcazə yoxdur.</CardContent></Card></div>;

  const props = { companyId, canCreate, actorUid: profile?.uid ?? '', baseCurrency: base };

  return (
    <div>
      <PageHeader title="Anbar" subtitle={`${active?.company.name} · mal/xidmət və davamlı uçot (Modul 5)`} />
      <Tabs defaultValue="stock">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="stock">Qalıqlar</TabsTrigger>
          <TabsTrigger value="catalog">Kataloq</TabsTrigger>
          <TabsTrigger value="movements">Hərəkətlər</TabsTrigger>
          <TabsTrigger value="transfers">Transferlər</TabsTrigger>
        </TabsList>
        <TabsContent value="stock"><StockTab {...props} /></TabsContent>
        <TabsContent value="catalog"><CatalogTab {...props} /></TabsContent>
        <TabsContent value="movements"><MovementsTab {...props} /></TabsContent>
        <TabsContent value="transfers"><TransfersTab {...props} /></TabsContent>
      </Tabs>
    </div>
  );
}
