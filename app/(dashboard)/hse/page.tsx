'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LibraryTab } from './library-tab';
import { JournalTab } from './journal-tab';
import { AuditTab } from './audit-tab';
import { PermitsTab } from './permits-tab';

export default function HsePage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const tt = useTT();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('hse.library.view') || can('hse.training.view') || can('hse.audit.view') || can('hse.permit.view');
  const uid = profile?.uid ?? '';

  if (!companyId) return <div><PageHeader title={tt('SƏTƏM uçotu', 'HSE records')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('Aktiv şirkət seçin.', 'Select an active company.')}</CardContent></Card></div>;
  if (!canView) return <div><PageHeader title={tt('SƏTƏM uçotu', 'HSE records')} /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('İcazə yoxdur.', 'No permission.')}</CardContent></Card></div>;

  const c = (p: string) => isSuperAdmin || can(p);

  return (
    <div>
      <PageHeader title={tt('SƏTƏM uçotu', 'HSE records')} subtitle={`${active?.company.name} · ${tt('Sağlamlıq, Əməyin Təhlükəsizliyi, Ətraf Mühit (Modul 11)', 'Health, Safety, Environment (Module 11)')}`} />
      <Tabs defaultValue="library">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="library">{tt('Kitabxana', 'Library')}</TabsTrigger>
          <TabsTrigger value="journal">{tt('SƏTƏM Jurnalı', 'HSE Journal')}</TabsTrigger>
          <TabsTrigger value="audit">{tt('Audit', 'Audit')}</TabsTrigger>
          <TabsTrigger value="permits">{tt('İş icazələri', 'Work permits')}</TabsTrigger>
        </TabsList>
        <TabsContent value="library"><LibraryTab companyId={companyId} uid={uid} canEdit={c('hse.library.create')} canDelete={c('hse.library.delete')} /></TabsContent>
        <TabsContent value="journal"><JournalTab companyId={companyId} uid={uid} canEdit={c('hse.training.create')} canConfig={c('hse.training.config')} canDelete={c('hse.training.delete')} /></TabsContent>
        <TabsContent value="audit"><AuditTab companyId={companyId} uid={uid} canEdit={c('hse.audit.create')} canDelete={c('hse.audit.delete')} /></TabsContent>
        <TabsContent value="permits"><PermitsTab companyId={companyId} uid={uid} canEdit={c('hse.permit.create')} canApprove={c('hse.permit.approve')} /></TabsContent>
      </Tabs>
    </div>
  );
}
