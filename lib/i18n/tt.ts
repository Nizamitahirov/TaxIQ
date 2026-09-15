'use client';

import { useLocale } from 'next-intl';

/**
 * Sadə iki-dilli mətn köməkçisi — next-intl açar faylları olmadan komponent
 * daxilində AZ/EN cütünü qaytarır. `const tt = useTT(); tt('Salam','Hello')`.
 */
export function useTT() {
  const locale = useLocale();
  return (az: string, en: string) => (locale === 'en' ? en : az);
}
