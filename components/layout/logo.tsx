import { cn } from '@/lib/utils/cn';

/** Yeganə brend aksenti — yaşıl "zəka qığılcımı" (həm açıq, həm tünd fonda oxunur). */
const BRAND_GREEN = '#22C55E';

/**
 * TAX iQ brend nişanı — adaptiv (monoxrom): plitə, yüksələn sütunlar və trend
 * oxu `currentColor`-dan gəlir, ona görə tünd fonda açıq, açıq fonda tünd olur
 * və həmişə kontrast yaradır. Yalnız yaşıl qığılcım nöqtəsi sabit aksentdir.
 * Dizayn: artım (sütun qrafiki) + yüksələn trend + zəka qığılcımı → "ağıllı vergi".
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn('shrink-0', className)} role="img" aria-label="TAX iQ">
      {/* adaptiv plitə (badge) */}
      <rect x="10" y="10" width="492" height="492" rx="128" fill="currentColor" fillOpacity="0.10" stroke="currentColor" strokeOpacity="0.22" strokeWidth="10" />
      {/* baza xətti */}
      <rect x="132" y="378" width="248" height="20" rx="10" fill="currentColor" fillOpacity="0.45" />
      {/* yüksələn sütunlar (artım) */}
      <rect x="150" y="300" width="58" height="70" rx="16" fill="currentColor" fillOpacity="0.45" />
      <rect x="227" y="250" width="58" height="120" rx="16" fill="currentColor" fillOpacity="0.68" />
      <rect x="304" y="196" width="58" height="174" rx="16" fill="currentColor" fillOpacity="0.92" />
      {/* yüksələn trend oxu */}
      <path d="M150 286 L256 220 L352 150" fill="none" stroke="currentColor" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M300 150 L352 150 L352 202" fill="none" stroke="currentColor" strokeWidth="30" strokeLinecap="round" strokeLinejoin="round" />
      {/* yaşıl zəka qığılcımı */}
      <circle cx="398" cy="118" r="36" fill={BRAND_GREEN} />
    </svg>
  );
}

/**
 * TAX iQ loqo — brend nişanı + söz-marka.
 * `i` hərfi ingilis (Latın, nöqtəli) hərfidir; `iQ` vurğulanır (intellekt).
 * Söz-marka `currentColor` istifadə edir — fon rənginə görə avtomatik tünd/açıq.
 * `subtitle` verildikdə «SMART TAX SOLUTIONS» alt yazısı göstərilir.
 */
export function Logo({ compact = false, subtitle = false }: { compact?: boolean; subtitle?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="h-9 w-9" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-lg font-extrabold tracking-tight">
            Tax<span className="text-[#22C55E]">i</span><span>Q</span>
          </span>
          {subtitle && (
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] opacity-60">Smart Tax Solutions</span>
          )}
        </span>
      )}
    </span>
  );
}
