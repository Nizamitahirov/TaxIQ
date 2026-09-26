import { cn } from '@/lib/utils/cn';

/** Brend rəngləri — loqo özü-özünə uyğun olsun deyə mövzu (theme) primary-dən asılı deyil. */
const BRAND_BLUE = '#1F5AEB';
const BRAND_GREEN = '#22C55E';

/** TaxIQ brand mark — mavi plitə + yüksələn trend oxu + yaşıl nöqtə + baza xətti */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn('shrink-0', className)} role="img" aria-label="TAX iQ">
      <rect width="512" height="512" rx="128" fill={BRAND_BLUE} />
      {/* baza xətti (faded) */}
      <rect x="150" y="374" width="212" height="24" rx="12" fill="#ffffff" opacity="0.82" />
      {/* yüksələn trend xətti */}
      <path d="M150 322 L214 352 L288 276 L360 200" fill="none" stroke="#ffffff" strokeWidth="42" strokeLinecap="round" strokeLinejoin="round" />
      {/* ox ucu (yuxarı-sağa) */}
      <path d="M300 200 L360 200 L360 260" fill="none" stroke="#ffffff" strokeWidth="42" strokeLinecap="round" strokeLinejoin="round" />
      {/* yaşıl nöqtə */}
      <circle cx="372" cy="150" r="34" fill={BRAND_GREEN} />
    </svg>
  );
}

/**
 * TAX iQ loqo — brend nişanı + söz-marka.
 * `i` hərfi ingilis (Latın, nöqtəli) hərfidir.
 * `subtitle` verildikdə «SMART TAX SOLUTIONS» alt yazısı göstərilir.
 */
export function Logo({ compact = false, subtitle = false }: { compact?: boolean; subtitle?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="h-9 w-9 rounded-xl shadow-[0_6px_18px_-6px_rgba(31,90,235,0.6)]" />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-lg font-extrabold tracking-tight">
            TAX&nbsp;<span>i</span><span style={{ color: BRAND_BLUE }}>Q</span>
          </span>
          {subtitle && (
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Smart Tax Solutions</span>
          )}
        </span>
      )}
    </span>
  );
}
