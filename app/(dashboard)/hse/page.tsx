'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LibraryTab } from './library-tab';
import { JournalTab } from './journal-tab';
import { AuditTab } from './audit-tab';
import { PermitsTab } from './permits-tab';

export default function HsePage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('hse.library.view') || can('hse.training.view') || can('hse.audit.view') || can('hse.permit.view');
  const uid = profile?.uid ?? '';

  if (!companyId) return <div><PageHeader title="SƏTƏM uçotu" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">Aktiv şirkət seçin.</CardContent></Card></div>;
  if (!canView) return <div><PageHeader title="SƏTƏM uçotu" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">İcazə yoxdur.</CardContent></Card></div>;

  const c = (p: string) => isSuperAdmin || can(p);

  return (
    <div>
      <PageHeader title="SƏTƏM uçotu" subtitle={`${active?.company.name} · Sağlamlıq, Əməyin Təhlükəsizliyi, Ətraf Mühit (Modul 11)`} />
      <Tabs defaultValue="library">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="library">Kitabxana</TabsTrigger>
          <TabsTrigger value="journal">SƏTƏM Jurnalı</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
          <TabsTrigger value="permits">İş icazələri</TabsTrigger>
        </TabsList>
        <TabsContent value="library"><LibraryTab companyId={companyId} uid={uid} canEdit={c('hse.library.create')} canDelete={c('hse.library.delete')} /></TabsContent>
        <TabsContent value="journal"><JournalTab companyId={companyId} uid={uid} canEdit={c('hse.training.create')} canConfig={c('hse.training.config')} canDelete={c('hse.training.delete')} /></TabsContent>
        <TabsContent value="audit"><AuditTab companyId={companyId} uid={uid} canEdit={c('hse.audit.create')} canDelete={c('hse.audit.delete')} /></TabsContent>
        <TabsContent value="permits"><PermitsTab companyId={companyId} uid={uid} canEdit={c('hse.permit.create')} canApprove={c('hse.permit.approve')} /></TabsContent>
      </Tabs>
    </div>
  );
}
