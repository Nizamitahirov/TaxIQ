'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, Plus, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { listCompanies } from '@/lib/firebase/companies';
import { SECTOR_MAP } from '@/lib/sectors';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ExportButton } from '@/components/shared/export-button';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary'> = {
  active: 'success', suspended: 'warning', draft: 'warning', archived: 'secondary',
};

export default function CompaniesPage() {
  const { isSuperAdmin, can } = useAuth();
  const tt = useTT();
  const sectorName = (s: string) => { const m = SECTOR_MAP[s]; return m ? tt(m.name.az, m.name.en) : s; };
  const canCreate = isSuperAdmin || can('platform.company.create');
  const { data, isLoading } = useQuery({ queryKey: ['companies'], queryFn: listCompanies, enabled: isSuperAdmin });

  if (!isSuperAdmin) {
    return (
      <div>
        <PageHeader title={tt('Şirkətlər', 'Companies')} />
        <Card className="rounded-card"><CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{tt('Bu bölmə yalnız Platform Super Admin üçündür.', 'This section is only for the Platform Super Admin.')}</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={tt('Şirkətlər', 'Companies')}
        subtitle={tt('Bütün müştəri şirkətləri və TaxIQ-ın öz profili (Company #1)', 'All client companies and TaxIQ\'s own profile (Company #1)')}
        action={<div className="flex items-center gap-2">
          <ExportButton filename="sirketler" rows={data ?? []} columns={[
            { header: tt('Ad', 'Name'), value: 'name' }, { header: 'VÖEN', value: (c) => c.taxId ?? '' },
            { header: tt('Sektor', 'Sector'), value: (c) => sectorName(c.sector) },
            { header: tt('Valyuta', 'Currency'), value: 'baseCurrency' }, { header: 'Status', value: 'status' },
            { header: tt('Daxili', 'Internal'), value: (c) => (c.isInternal ? tt('Bəli', 'Yes') : tt('Xeyr', 'No')) },
          ]} />
          {canCreate && <Button asChild><Link href="/companies/new"><Plus className="h-4 w-4" /> {tt('Yeni müştəri', 'New client')}</Link></Button>}
        </div>}
      />
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data || data.length === 0 ? (
        <EmptyState title={tt('Şirkət yoxdur', 'No companies')} description={tt('İlk müştəri şirkətini yaradın.', 'Create the first client company.')} action={<Button asChild><Link href="/companies/new"><Plus className="h-4 w-4" /> {tt('Yeni müştəri', 'New client')}</Link></Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <Link key={c.id} href={`/companies/${c.id}`}>
              <Card className="rounded-card transition-shadow hover:shadow-soft-lg">
                <CardContent className="flex items-start gap-3 p-5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">{c.name.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{c.name}</p>
                      {c.isInternal && <Building2 className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{c.taxId ? `VÖEN ${c.taxId}` : '—'} · {c.baseCurrency}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant={STATUS_VARIANT[c.status] ?? 'secondary'}>{c.status}</Badge>
                      <span className="text-xs text-muted-foreground">{sectorName(c.sector)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
