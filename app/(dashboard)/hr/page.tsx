'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
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
  const tt = useTT();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('hr.employee.view');
  const canCreate = isSuperAdmin || can('hr.employee.create');
  const canViewSalary = isSuperAdmin || can('hr.employee.salary.view');
  const canApprove = isSuperAdmin || can('hr.leave.approve');
  const baseCurrency = active?.company.baseCurrency ?? 'AZN';

  if (!companyId) return <div><PageHeader title={tt('İnsan Resursları', 'Human Resources')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('Aktiv şirkət seçin.', 'Select an active company.')}</CardContent></Card></div>;
  if (!canView) return <div><PageHeader title={tt('İnsan Resursları', 'Human Resources')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('İcazə yoxdur.', 'No permission.')}</CardContent></Card></div>;

  const base = { companyId, canCreate, actorUid: profile?.uid ?? '' };

  return (
    <div>
      <PageHeader title={tt('İnsan Resursları', 'Human Resources')} subtitle={`${active?.company.name} · ${tt('işçi həyat dövrü, məzuniyyət, tabel, əmrlər (Modul 10)', 'employee lifecycle, leave, timesheet, orders (Module 10)')}`} />
      <Tabs defaultValue="employees">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="employees">{tt('İşçilər', 'Employees')}</TabsTrigger>
          <TabsTrigger value="leave">{tt('Məzuniyyət', 'Leave')}</TabsTrigger>
          <TabsTrigger value="balances">{tt('Balanslar', 'Balances')}</TabsTrigger>
          <TabsTrigger value="permissions">{tt('Saatlıq icazə', 'Hourly permission')}</TabsTrigger>
          <TabsTrigger value="trips">{tt('Ezamiyyət', 'Business trips')}</TabsTrigger>
          <TabsTrigger value="timesheet">{tt('Tabel', 'Timesheet')}</TabsTrigger>
          <TabsTrigger value="orders">{tt('Əmrlər', 'Orders')}</TabsTrigger>
          <TabsTrigger value="contracts">{tt('Müqavilələr', 'Contracts')}</TabsTrigger>
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
