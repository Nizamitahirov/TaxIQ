'use client';

import { useTranslations } from 'next-intl';
import { Construction } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from './page-header';

/**
 * Hazırlanmada olan modullar üçün ümumi placeholder.
 * Modul 1 (Auth/RBAC) və Dashboard tam qurulub; qalan modullar (2, 4–10)
 * spesifikasiyalara uyğun mərhələli şəkildə əlavə olunacaq.
 */
export function ModulePlaceholder({ title, subtitle, specFile }: { title: string; subtitle?: string; specFile?: string }) {
  const t = useTranslations('common');
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="rounded-card">
        <CardContent className="flex flex-col items-center gap-4 py-20 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Construction className="h-8 w-8" />
          </span>
          <div>
            <p className="text-lg font-semibold">{t('comingSoon')}</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">{t('moduleInProgress')}</p>
            {specFile && <p className="mt-2 text-xs text-muted-foreground/70">Spesifikasiya: <code className="rounded bg-muted px-1.5 py-0.5">{specFile}</code></p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
