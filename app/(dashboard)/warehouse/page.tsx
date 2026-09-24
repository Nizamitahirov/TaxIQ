'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CatalogTab } from './catalog-tab';
import { StockTab } from './stock-tab';
import { MovementsTab } from './movements-tab';
import { TransfersTab } from './transfers-tab';
import { StocktakeTab } from './stocktake-tab';
import { PriceListsTab } from './pricelists-tab';

export default function WarehousePage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const tt = useTT();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('warehouse.stock.view') || can('warehouse.goods.view');
  const canCreate = isSuperAdmin || can('warehouse.stock.create') || can('warehouse.goods.create');
  const base = active?.company.baseCurrency ?? 'AZN';

  if (!companyId) return <div><PageHeader title={tt('Anbar', 'Warehouse')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('Aktiv şirkət seçin.', 'Select an active company.')}</CardContent></Card></div>;
  if (!canView) return <div><PageHeader title={tt('Anbar', 'Warehouse')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('İcazə yoxdur.', 'No permission.')}</CardContent></Card></div>;

  const props = { companyId, canCreate, actorUid: profile?.uid ?? '', baseCurrency: base };

  return (
    <div>
      <PageHeader title={tt('Anbar', 'Warehouse')} subtitle={`${active?.company.name} · ${tt('mal/xidmət və davamlı uçot (Modul 5)', 'goods/services & perpetual inventory (Module 5)')}`} />
      <Tabs defaultValue="stock">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="stock">{tt('Qalıqlar', 'Stock')}</TabsTrigger>
          <TabsTrigger value="catalog">{tt('Kataloq', 'Catalog')}</TabsTrigger>
          <TabsTrigger value="movements">{tt('Hərəkətlər', 'Movements')}</TabsTrigger>
          <TabsTrigger value="transfers">{tt('Transferlər', 'Transfers')}</TabsTrigger>
          <TabsTrigger value="stocktake">{tt('İnventarizasiya', 'Stocktake')}</TabsTrigger>
          <TabsTrigger value="pricelists">{tt('Qiymət siyahıları', 'Price lists')}</TabsTrigger>
        </TabsList>
        <TabsContent value="stock"><StockTab {...props} /></TabsContent>
        <TabsContent value="catalog"><CatalogTab {...props} /></TabsContent>
        <TabsContent value="movements"><MovementsTab {...props} /></TabsContent>
        <TabsContent value="transfers"><TransfersTab {...props} /></TabsContent>
        <TabsContent value="stocktake"><StocktakeTab {...props} /></TabsContent>
        <TabsContent value="pricelists"><PriceListsTab {...props} /></TabsContent>
      </Tabs>
    </div>
  );
}
