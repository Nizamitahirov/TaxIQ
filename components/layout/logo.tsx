import { cn } from '@/lib/utils/cn';

/** TaxIQ logo — periwinkle gradient mark + wordmark */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#5B5BF5] to-[#8b3df0] text-sm font-extrabold text-white shadow-[0_6px_18px_-6px_rgba(91,91,245,0.7)]">
        TQ
      </span>
      {!compact && (
        <span className={cn('text-lg font-extrabold tracking-tight')}>
          Tax<span className="text-primary">IQ</span>
        </span>
      )}
    </span>
  );
}
