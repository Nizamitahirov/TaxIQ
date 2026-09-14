'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PeriodProvider } from '@/components/providers/period-provider';
import { CommandPalette } from './command-palette';
import { ShortcutsHelp } from './shortcuts-help';
import { WelcomeTour } from './welcome-tour';

interface ShellCtx { openPalette: (mode?: 'all' | 'create') => void; openHelp: () => void; openTour: () => void }
const Ctx = createContext<ShellCtx>({ openPalette: () => {}, openHelp: () => {}, openTour: () => {} });
export const useShell = () => useContext(Ctx);

const TOUR_KEY = 'taxiq.onboarded';

// g-prefiksli naviqasiya qısayolları
const GOTO: Record<string, string> = {
  d: '/dashboard', h: '/launch', s: '/sales', a: '/warehouse',
  m: '/accounting', k: '/hr', r: '/ifrs', c: '/cashbank',
};

export function ShellProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'all' | 'create'>('all');
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const gPending = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openPalette = useCallback((m: 'all' | 'create' = 'all') => { setMode(m); setOpen(true); }, []);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const openTour = useCallback(() => setTourOpen(true), []);

  // İlk giriş — təqdimat turu bir dəfə göstərilir
  useEffect(() => {
    try { if (!localStorage.getItem(TOUR_KEY)) setTourOpen(true); } catch { /* ignore */ }
  }, []);
  const closeTour = useCallback(() => {
    setTourOpen(false);
    try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* ignore */ }
  }, []);

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
      if (e.key === 'c') { e.preventDefault(); openPalette('create'); return; }
      if (e.key === '?') { e.preventDefault(); setHelpOpen(true); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openPalette, router]);

  return (
    <Ctx.Provider value={{ openPalette, openHelp, openTour }}>
      <PeriodProvider>
        {children}
        <CommandPalette open={open} onOpenChange={setOpen} mode={mode} />
        <ShortcutsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
        <WelcomeTour open={tourOpen} onClose={closeTour} />
      </PeriodProvider>
    </Ctx.Provider>
  );
}
