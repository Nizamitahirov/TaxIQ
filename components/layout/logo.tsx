import { cn } from '@/lib/utils/cn';

/** Yeganə brend aksenti — yaşıl nöqtə (həm açıq, həm tünd fonda oxunur). */
const BRAND_GREEN = '#22C55E';

/**
 * TAX iQ brend nişanı — adaptiv (monoxrom): plitə, trend oxu və baza xətti
 * `currentColor`-dan gəlir, ona görə tünd fonda açıq, açıq fonda tünd olur
 * və həmişə kontrast yaradır. Yalnız yaşıl nöqtə sabit aksentdir.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn('shrink-0', className)} role="img" aria-label="TAX iQ">
      {/* adaptiv plitə (badge) */}
      <rect x="8" y="8" width="496" height="496" rx="124" fill="currentColor" fillOpacity="0.12" stroke="currentColor" strokeOpacity="0.25" strokeWidth="10" />
      {/* baza xətti */}
      <rect x="150" y="374" width="212" height="24" rx="12" fill="currentColor" fillOpacity="0.55" />
      {/* yüksələn trend xətti */}
      <path d="M150 322 L214 352 L288 276 L360 200" fill="none" stroke="currentColor" strokeWidth="42" strokeLinecap="round" strokeLinejoin="round" />
      {/* ox ucu (yuxarı-sağa) */}
      <path d="M300 200 L360 200 L360 260" fill="none" stroke="currentColor" strokeWidth="42" strokeLinecap="round" strokeLinejoin="round" />
      {/* yaşıl aksent nöqtə */}
      <circle cx="372" cy="150" r="34" fill={BRAND_GREEN} />
    </svg>
  );
}

/**
 * TAX iQ loqo — brend nişanı + söz-marka.
 * `i` hərfi ingilis (Latın, nöqtəli) hərfidir. Söz-marka `currentColor`
 * istifadə edir, ona görə fon rənginə görə avtomatik tünd/açıq olur.
 * `subtitle` verildikdə «SMART TAX SOLUTIONS» alt yazısı göstərilir.
 */
export function Logo({ compact = false, subtitle = false }: { compact?: boolean; subtitle?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="h-9 w-9" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-lg font-extrabold tracking-tight">
            TAX&nbsp;<span>i</span><span>Q</span>
          </span>
          {subtitle && (
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-60">Smart Tax Solutions</span>
          )}
        </span>
      )}
    </span>
  );
}
