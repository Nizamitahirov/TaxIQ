'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EmployeesTab } from './employees-tab';
import { LeaveTab } from './leave-tab';
import { BalancesTab } from './balances-tab';
import { PermissionsTab } from './permissions-tab';
import { TripsTab } from './trips-tab';
import { TimesheetTab } from './timesheet-tab';
import { OrdersTab } from './orders-tab';
import { ContractsTab } from './contracts-tab';

export default function HRPage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('hr.employee.view');
  const canCreate = isSuperAdmin || can('hr.employee.create');
  const canViewSalary = isSuperAdmin || can('hr.employee.salary.view');
  const canApprove = isSuperAdmin || can('hr.leave.approve');
  const baseCurrency = active?.company.baseCurrency ?? 'AZN';

  if (!companyId) return <div><PageHeader title="İnsan Resursları" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Aktiv şirkət seçin.</CardContent></Card></div>;
  if (!canView) return <div><PageHeader title="İnsan Resursları" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">İcazə yoxdur.</CardContent></Card></div>;

  const base = { companyId, canCreate, actorUid: profile?.uid ?? '' };

  return (
    <div>
      <PageHeader title="İnsan Resursları" subtitle={`${active?.company.name} · işçi həyat dövrü, məzuniyyət, tabel, əmrlər (Modul 10)`} />
      <Tabs defaultValue="employees">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="employees">İşçilər</TabsTrigger>
          <TabsTrigger value="leave">Məzuniyyət</TabsTrigger>
          <TabsTrigger value="balances">Balanslar</TabsTrigger>
          <TabsTrigger value="permissions">Saatlıq icazə</TabsTrigger>
          <TabsTrigger value="trips">Ezamiyyət</TabsTrigger>
          <TabsTrigger value="timesheet">Tabel</TabsTrigger>
          <TabsTrigger value="orders">Əmrlər</TabsTrigger>
          <TabsTrigger value="contracts">Müqavilələr</TabsTrigger>
        </TabsList>
        <TabsContent value="employees"><EmployeesTab {...base} canViewSalary={canViewSalary} baseCurrency={baseCurrency} company={active?.company} /></TabsContent>
        <TabsContent value="leave"><LeaveTab {...base} canApprove={canApprove} /></TabsContent>
        <TabsContent value="balances"><BalancesTab companyId={companyId} canApprove={canApprove} /></TabsContent>
        <TabsContent value="permissions"><PermissionsTab {...base} canApprove={canApprove} /></TabsContent>
        <TabsContent value="trips"><TripsTab {...base} canApprove={canApprove} baseCurrency={baseCurrency} /></TabsContent>
        <TabsContent value="timesheet"><TimesheetTab {...base} canApprove={canApprove} /></TabsContent>
        <TabsContent value="orders"><OrdersTab {...base} company={active?.company} /></TabsContent>
        <TabsContent value="contracts"><ContractsTab {...base} baseCurrency={baseCurrency} company={active?.company} /></TabsContent>
      </Tabs>
    </div>
  );
}
