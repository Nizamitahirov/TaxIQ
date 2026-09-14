'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PeriodProvider } from '@/components/providers/period-provider';
import { CommandPalette } from './command-palette';

interface ShellCtx { openPalette: (mode?: 'all' | 'create') => void }
const Ctx = createContext<ShellCtx>({ openPalette: () => {} });
export const useShell = () => useContext(Ctx);

// g-prefiksli naviqasiya qısayolları
const GOTO: Record<string, string> = {
  d: '/dashboard', h: '/launch', s: '/sales', a: '/warehouse',
  m: '/accounting', k: '/hr', r: '/ifrs', c: '/cashbank',
};

export function ShellProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'all' | 'create'>('all');
  const gPending = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openPalette = useCallback((m: 'all' | 'create' = 'all') => { setMode(m); setOpen(true); }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette('all'); return; }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (gPending.current) {
        gPending.current = false;
        if (gTimer.current) clearTimeout(gTimer.current);
        const to = GOTO[e.key.toLowerCase()];
        if (to) { e.preventDefault(); router.push(to); }
        return;
      }
      if (e.key === 'g') { gPending.current = true; gTimer.current = setTimeout(() => { gPending.current = false; }, 900); return; }
      if (e.key === 'c') { e.preventDefault(); openPalette('create'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPalette, router]);

  return (
    <Ctx.Provider value={{ openPalette }}>
      <PeriodProvider>
        {children}
        <CommandPalette open={open} onOpenChange={setOpen} mode={mode} />
      </PeriodProvider>
    </Ctx.Provider>
  );
}
