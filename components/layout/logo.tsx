import { cn } from '@/lib/utils/cn';

/** TaxIQ brand mark — gradient tile with an upward trend/check + IQ spark */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={cn('shrink-0', className)} role="img" aria-label="TaxIQ">
      <defs>
        <linearGradient id="taxiq-mark" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5B5BF5" />
          <stop offset="1" stopColor="#8B3DF0" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="120" fill="url(#taxiq-mark)" />
      <path d="M150 292 L233 366 L372 178" fill="none" stroke="#ffffff" strokeWidth="48" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="392" cy="150" r="27" fill="#ffffff" />
    </svg>
  );
}

/** TaxIQ logo — brand mark + wordmark */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark className="h-9 w-9 rounded-xl shadow-[0_6px_18px_-6px_rgba(91,91,245,0.7)]" />
      {!compact && (
        <span className={cn('text-lg font-extrabold tracking-tight')}>
          Tax<span className="text-primary">IQ</span>
        </span>
      )}
    </span>
  );
}
