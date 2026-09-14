'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface PeriodCtx { year: number; setYear: (y: number) => void }
const Ctx = createContext<PeriodCtx>({ year: new Date().getFullYear(), setYear: () => {} });
export const usePeriod = () => useContext(Ctx);

const KEY = 'taxiq.period.year';

/** Qlobal hesabat dövrü konteksti (il) — IFRS və hesabatlar buradan oxuyur (faza 2) */
export function PeriodProvider({ children }: { children: ReactNode }) {
  const [year, setYearState] = useState(new Date().getFullYear());
  useEffect(() => {
    try { const s = localStorage.getItem(KEY); if (s) setYearState(Number(s)); } catch { /* ignore */ }
  }, []);
  const setYear = (y: number) => {
    setYearState(y);
    try { localStorage.setItem(KEY, String(y)); } catch { /* ignore */ }
  };
  return <Ctx.Provider value={{ year, setYear }}>{children}</Ctx.Provider>;
}
