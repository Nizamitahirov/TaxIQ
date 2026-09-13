'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Building2, Plus, Loader2, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { listCompanies } from '@/lib/firebase/companies';
import { SECTOR_MAP } from '@/lib/sectors';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'secondary'> = {
  active: 'success', suspended: 'warning', draft: 'warning', archived: 'secondary',
};

export default function CompaniesPage() {
  const { isSuperAdmin, can } = useAuth();
  const canCreate = isSuperAdmin || can('platform.company.create');
  const { data, isLoading } = useQuery({ queryKey: ['companies'], queryFn: listCompanies, enabled: isSuperAdmin });

  if (!isSuperAdmin) {
    return (
      <div>
        <PageHeader title="Şirkətlər" />
        <Card className="rounded-card"><CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Bu bölmə yalnız Platform Super Admin üçündür.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Şirkətlər"
        subtitle="Bütün müştəri şirkətləri və TaxIQ-ın öz profili (Company #1)"
        action={canCreate && <Button asChild><Link href="/companies/new"><Plus className="h-4 w-4" /> Yeni müştəri</Link></Button>}
      />
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data || data.length === 0 ? (
        <EmptyState title="Şirkət yoxdur" description="İlk müştəri şirkətini yaradın." action={<Button asChild><Link href="/companies/new"><Plus className="h-4 w-4" /> Yeni müştəri</Link></Button>} />
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
                      <span className="text-xs text-muted-foreground">{SECTOR_MAP[c.sector]?.name.az ?? c.sector}</span>
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
