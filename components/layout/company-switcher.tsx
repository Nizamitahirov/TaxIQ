'use client';

import { useState, useEffect } from 'react';
import { Building2, Check, ChevronsUpDown, Search } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { cn } from '@/lib/utils/cn';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Company Switcher — 01 §0.3.
 * Staff/Super Admin aktiv şirkəti bir kliklə dəyişir. Client User üçün göstərilmir
 * (yalnız 1 şirkəti var).
 */
export function CompanySwitcher() {
  const { memberships, active, switchCompany, profile } = useAuth();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);

  const multi = profile?.userType !== 'client_user' && memberships.length > 1;

  // Cmd/Ctrl+K ilə şirkət seçicisini aç (01 §0.3)
  useEffect(() => {
    if (!multi) return;
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [multi]);

  // Client user və ya tək şirkət → sadəcə ad (switcher yox)
  if (profile?.userType === 'client_user' || memberships.length <= 1) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5">
        <Building2 className="h-4 w-4 text-primary" />
        <span className="max-w-[180px] truncate text-sm font-semibold">{active?.company.name ?? '—'}</span>
      </div>
    );
  }

  const filtered = memberships.filter((m) =>
    m.company.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-secondary">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="max-w-[160px] truncate font-semibold">{active?.company.name ?? 'Şirkət seç'}</span>
          <kbd className="ml-1 hidden items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">⌘K</kbd>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-0">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Şirkət axtar..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-80 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nəticə yoxdur</p>
          )}
          {filtered.map((m) => {
            const isActive = m.companyId === active?.companyId;
            return (
              <button
                key={m.companyId}
                onClick={() => { switchCompany(m.companyId); setOpen(false); setQ(''); }}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-secondary',
                  isActive && 'bg-primary/5',
                )}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                  {m.company.name.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.company.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{m.roleName}{m.company.isInternal ? ' · Daxili' : ''}</span>
                </span>
                {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
