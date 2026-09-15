'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, CornerDownLeft, ArrowRight, Plus, LayoutGrid, type LucideIcon } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useTT } from '@/lib/i18n/tt';
import { usePermittedNavItems } from '@/components/layout/use-nav';
import { useEntitySearch } from './use-entity-search';
import { AREAS } from '@/lib/areas';
import { CREATE_ACTIONS } from '@/lib/create-actions';
import { cn } from '@/lib/utils/cn';

interface Cmd { id: string; label: string; hint?: string; icon: LucideIcon; run: () => void; group: string }

export function CommandPalette({ open, onOpenChange, mode }: { open: boolean; onOpenChange: (o: boolean) => void; mode: 'all' | 'create' }) {
  const router = useRouter();
  const t = useTranslations('nav');
  const tt = useTT();
  const { canAccess, isSuperAdmin } = useAuth();
  const navItems = usePermittedNavItems();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const go = (href: string) => { onOpenChange(false); router.push(href); };
  const { results: entityResults, loading: searchLoading } = useEntitySearch(q, open && mode === 'all');

  const commands = useMemo<Cmd[]>(() => {
    const create: Cmd[] = CREATE_ACTIONS.filter((a) => isSuperAdmin || canAccess(a.module))
      .map((a) => ({ id: `c:${a.label}`, label: tt(a.label, a.labelEn), icon: a.icon, run: () => go(a.href), group: 'Yarat' }));
    if (mode === 'create') return create;
    const areas: Cmd[] = AREAS.map((a) => ({ id: `a:${a.key}`, label: tt(a.label, a.labelEn), hint: tt('Bölmə', 'Workspace'), icon: a.icon, run: () => go(a.landing), group: 'Bölmələr' }));
    const nav: Cmd[] = navItems.map((i) => ({ id: `n:${i.href}`, label: t(i.labelKey), icon: i.icon, run: () => go(i.href), group: 'Naviqasiya' }));
    const fixed: Cmd[] = [
      { id: 'n:/launch', label: tt('Bölmələr (Hub)', 'Workspaces (Hub)'), icon: LayoutGrid, run: () => go('/launch'), group: 'Naviqasiya' },
    ];
    return [...fixed, ...nav, ...areas, ...create];
  }, [mode, navItems, canAccess, isSuperAdmin, t, tt]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const entityCmds: Cmd[] = entityResults.map((r) => ({ id: r.id, label: r.label, hint: r.sublabel, icon: r.icon, run: () => go(r.href), group: 'Nəticələr' }));
    if (!s) return commands;
    const staticFiltered = commands.filter((c) => c.label.toLowerCase().includes(s) || c.group.toLowerCase().includes(s));
    return [...entityCmds, ...staticFiltered];
  }, [q, commands, entityResults]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (open) { setQ(''); setIdx(0); setTimeout(() => inputRef.current?.focus(), 20); } }, [open, mode]);
  useEffect(() => { setIdx(0); }, [q]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onOpenChange(false); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, filtered.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); filtered[idx]?.run(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, filtered, idx, onOpenChange]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-i="${idx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  if (!open) return null;

  // Qruplaşdırma qaydası (açarlar stabil AZ, başlıqlar tərcümə olunur)
  const order = ['Nəticələr', 'Yarat', 'Naviqasiya', 'Bölmələr'];
  const groupLabel: Record<string, string> = { 'Nəticələr': tt('Nəticələr', 'Results'), 'Yarat': tt('Yarat', 'Create'), 'Naviqasiya': tt('Naviqasiya', 'Navigation'), 'Bölmələr': tt('Bölmələr', 'Workspaces') };
  const groups = order.map((g) => ({ g, items: filtered.filter((c) => c.group === g) })).filter((x) => x.items.length > 0);
  let flatIndex = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[12vh]" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in-0" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl animate-in fade-in-0 zoom-in-95">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={mode === 'create' ? tt('Nə yaratmaq istəyirsiniz?', 'What do you want to create?') : tt('Səhifə, bölmə və ya əməliyyat axtar…', 'Search a page, workspace or action…')}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:block">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{searchLoading ? tt('Axtarılır…','Searching…') : tt('Nəticə yoxdur','No results')}</p>
          ) : groups.map(({ g, items }) => (
            <div key={g} className="mb-1">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">{groupLabel[g] ?? g}</p>
              {items.map((c) => {
                flatIndex++;
                const active = flatIndex === idx;
                const my = flatIndex;
                const Icon = c.icon;
                return (
                  <button key={c.id} data-i={my} onMouseEnter={() => setIdx(my)} onClick={() => c.run()}
                    className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors', active ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-secondary')}>
                    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', active ? 'bg-primary/15' : 'bg-secondary')}>
                      {g === 'Yarat' ? <Plus className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </span>
                    <span className="flex-1 truncate">{c.label}</span>
                    {c.hint && <span className="text-[11px] text-muted-foreground">{c.hint}</span>}
                    {active && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                    {!active && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1">↑</kbd><kbd className="rounded border border-border px-1">↓</kbd> {tt("naviqasiya","navigate")}</span>
          <span className="flex items-center gap-1"><kbd className="rounded border border-border px-1">↵</kbd> {tt("seç","select")}</span>
          <span className="ml-auto flex items-center gap-1"><kbd className="rounded border border-border px-1">⌘K</kbd> {tt("aç/bağla","toggle")}</span>
        </div>
      </div>
    </div>
  );
}
