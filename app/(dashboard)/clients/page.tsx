'use client';

import Link from 'next/link';
import { Building2, ArrowRightLeft, Check, Plus } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { SECTOR_MAP } from '@/lib/sectors';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Müştəri şirkətləri — istifadəçinin əlçatan olduğu Company-lər (praktika idarəetmə modeli).
 * Super Admin üçün bütün şirkətlər /companies-dədir; burada aktiv keçid rahatlığı verilir.
 */
export default function ClientsPage() {
  const { memberships, active, switchCompany, isSuperAdmin, can } = useAuth();
  const tt = useTT();
  const canCreate = isSuperAdmin || can('platform.company.create');
  const clients = memberships.filter((m) => !m.company.isInternal);

  return (
    <div>
      <PageHeader
        title={tt('Müştərilər', 'Clients')}
        subtitle={tt('Sizin təyin olunduğunuz müştəri şirkətləri', 'Client companies you are assigned to')}
        action={canCreate && <Button asChild><Link href="/companies/new"><Plus className="h-4 w-4" /> {tt('Yeni müştəri', 'New client')}</Link></Button>}
      />
      {memberships.length === 0 ? (
        <EmptyState title={tt('Şirkət təyinatı yoxdur', 'No company assignments')} description={tt('Administratorla əlaqə saxlayın.', 'Contact your administrator.')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map((m) => {
            const isActive = m.companyId === active?.companyId;
            return (
              <Card key={m.companyId} className={isActive ? 'rounded-card ring-1 ring-primary' : 'rounded-card transition-shadow hover:shadow-soft-lg'}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{m.company.name.slice(0, 2).toUpperCase()}</span>
                    {isActive ? <Badge variant="success"><Check className="mr-1 h-3 w-3" /> {tt('Aktiv', 'Active')}</Badge> : <Badge variant="secondary">{m.roleName}</Badge>}
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 font-semibold">{m.company.name} {m.company.isInternal && <Building2 className="h-3.5 w-3.5 text-primary" />}</p>
                  <p className="text-xs text-muted-foreground">{m.company.isInternal ? tt('Daxili (TaxIQ)', 'Internal (TaxIQ)') : (SECTOR_MAP[m.company.sector] ? tt(SECTOR_MAP[m.company.sector].name.az, SECTOR_MAP[m.company.sector].name.en) : m.company.sector)} · {m.roleName}</p>
                  <div className="mt-3 flex items-center gap-2">
                    {!isActive && <Button variant="outline" size="sm" onClick={() => switchCompany(m.companyId)}><ArrowRightLeft className="h-3.5 w-3.5" /> {tt('Keçid et', 'Switch')}</Button>}
                    <Button variant="ghost" size="sm" asChild><Link href="/dashboard">{tt('Panelə bax →', 'View panel →')}</Link></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {clients.length === 0 && memberships.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">{tt('Yalnız daxili şirkətə təyin olunmusunuz. Müştəri şirkətləri əlavə olunduqca burada görünəcək.', 'You are assigned only to the internal company. Client companies will appear here as they are added.')}</p>
      )}
    </div>
  );
}
