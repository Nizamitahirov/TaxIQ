'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EmployeesTab } from './employees-tab';
import { LeaveTab } from './leave-tab';

export default function HRPage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('hr.employee.view');
  const canCreate = isSuperAdmin || can('hr.employee.create');
  const canViewSalary = isSuperAdmin || can('hr.employee.salary.view');

  if (!companyId) return <div><PageHeader title="İnsan Resursları" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Aktiv şirkət seçin.</CardContent></Card></div>;
  if (!canView) return <div><PageHeader title="İnsan Resursları" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">İcazə yoxdur.</CardContent></Card></div>;

  const props = { companyId, canCreate, actorUid: profile?.uid ?? '' };

  return (
    <div>
      <PageHeader title="İnsan Resursları" subtitle={`${active?.company.name} · işçilər və məzuniyyət (Modul 10)`} />
      <Tabs defaultValue="employees">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="employees">İşçilər</TabsTrigger>
          <TabsTrigger value="leave">Məzuniyyət</TabsTrigger>
        </TabsList>
        <TabsContent value="employees"><EmployeesTab {...props} canViewSalary={canViewSalary} baseCurrency={active?.company.baseCurrency ?? 'AZN'} /></TabsContent>
        <TabsContent value="leave"><LeaveTab {...props} canApprove={isSuperAdmin || can('hr.leave.approve')} /></TabsContent>
      </Tabs>
    </div>
  );
}
