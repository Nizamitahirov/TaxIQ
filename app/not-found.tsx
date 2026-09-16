'use client';

import Link from 'next/link';
import { useTT } from '@/lib/i18n/tt';

export default function NotFound() {
  const tt = useTT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-6xl font-bold text-primary">404</p>
      <p className="text-lg font-medium">{tt('Səhifə tapılmadı', 'Page not found')}</p>
      <p className="text-sm text-muted-foreground">{tt('Axtardığınız səhifə mövcud deyil və ya köçürülüb.', 'The page you are looking for does not exist or has been moved.')}</p>
      <Link href="/dashboard" className="rounded-button bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        {tt('İdarə panelinə qayıt', 'Back to dashboard')}
      </Link>
    </div>
  );
}
