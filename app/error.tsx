'use client';

import { useEffect } from 'react';
import { useTT } from '@/lib/i18n/tt';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const tt = useTT();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="font-display text-4xl font-bold text-danger">{tt('Xəta baş verdi', 'An error occurred')}</p>
      <p className="max-w-md text-sm text-muted-foreground">
        {tt('Gözlənilməz xəta yarandı. Yenidən cəhd edin və ya səhifəni yeniləyin.', 'An unexpected error occurred. Try again or reload the page.')}
      </p>
      <button onClick={reset} className="rounded-button bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
        {tt('Yenidən cəhd et', 'Try again')}
      </button>
    </div>
  );
}
