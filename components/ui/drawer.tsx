'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Sağdan açılan panel (drawer) — sənəd detalı/redaktəsi üçün.
 * Naviqasiya kontekstini itirmədən məzmun göstərir (web-app pattern, faza 3).
 */
export function Drawer({ open, onClose, title, description, children, footer, width = 'md' }: {
  open: boolean; onClose: () => void; title?: ReactNode; description?: ReactNode;
  children: ReactNode; footer?: ReactNode; width?: 'sm' | 'md' | 'lg';
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;
  const w = width === 'lg' ? 'max-w-2xl' : width === 'sm' ? 'max-w-sm' : 'max-w-lg';

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in-0" onClick={onClose} />
      <div className={cn('absolute right-0 top-0 flex h-full w-full flex-col border-l border-border bg-card shadow-2xl animate-in slide-in-from-right', w)}>
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="truncate text-lg font-bold">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Bağla" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
