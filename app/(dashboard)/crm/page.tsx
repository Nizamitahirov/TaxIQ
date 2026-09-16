'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PipelineTab } from './pipeline-tab';
import { LeadsTab } from './leads-tab';
import { OpportunitiesTab } from './opportunities-tab';
import { ContactsTab } from './contacts-tab';
import { CampaignsTab } from './campaigns-tab';
import { ActivityTab } from './activity-tab';
import { AnalyticsTab } from './analytics-tab';

export default function CrmPage() {
  const { active, can, isSuperAdmin, profile } = useAuth();
  const tt = useTT();
  const companyId = active?.companyId;
  const canView = isSuperAdmin || can('crm.lead.view') || can('crm.opportunity.view');
  const canEdit = isSuperAdmin || can('crm.lead.create') || can('crm.opportunity.create');
  const canConvert = isSuperAdmin || can('crm.convert');
  const base = active?.company.baseCurrency ?? 'AZN';
  const uid = profile?.uid ?? '';
  const uname = profile?.displayName ?? null;

  if (!companyId) return <div><PageHeader title="CRM" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('Aktiv şirkət seçin.', 'Select an active company.')}</CardContent></Card></div>;
  if (!canView) return <div><PageHeader title="CRM" /><Card className="rounded-card"><CardContent className="py-16 text-center text-sm text-muted-foreground">{tt('İcazə yoxdur.', 'No permission.')}</CardContent></Card></div>;

  const common = { companyId, canEdit, canConvert, actorUid: uid, actorName: uname, baseCurrency: base };

  return (
    <div>
      <PageHeader title={tt('CRM — Müştəri münasibətləri', 'CRM — Customer relations')}
        subtitle={`${active?.company.name} · ${tt('Lead → İmkan → Təklif → Müştəri', 'Lead → Opportunity → Quote → Customer')}`} />
      <Tabs defaultValue="pipeline">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="pipeline">{tt('Pipeline', 'Pipeline')}</TabsTrigger>
          <TabsTrigger value="leads">{tt('Lead-lər', 'Leads')}</TabsTrigger>
          <TabsTrigger value="opportunities">{tt('İmkanlar', 'Opportunities')}</TabsTrigger>
          <TabsTrigger value="contacts">{tt('Kontaktlar', 'Contacts')}</TabsTrigger>
          <TabsTrigger value="campaigns">{tt('Kampaniyalar', 'Campaigns')}</TabsTrigger>
          <TabsTrigger value="activity">{tt('Aktivlik', 'Activity')}</TabsTrigger>
          <TabsTrigger value="analytics">{tt('Analitika', 'Analytics')}</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline"><PipelineTab {...common} /></TabsContent>
        <TabsContent value="leads"><LeadsTab {...common} /></TabsContent>
        <TabsContent value="opportunities"><OpportunitiesTab {...common} /></TabsContent>
        <TabsContent value="contacts"><ContactsTab {...common} /></TabsContent>
        <TabsContent value="campaigns"><CampaignsTab {...common} /></TabsContent>
        <TabsContent value="activity"><ActivityTab {...common} /></TabsContent>
        <TabsContent value="analytics"><AnalyticsTab {...common} /></TabsContent>
      </Tabs>
    </div>
  );
}

export interface CrmTabProps {
  companyId: string;
  canEdit: boolean;
  canConvert: boolean;
  actorUid: string;
  actorName: string | null;
  baseCurrency: string;
}
