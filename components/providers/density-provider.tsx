'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Density = 'comfortable' | 'compact';
interface DensityCtx { density: Density; setDensity: (d: Density) => void; toggle: () => void }
const Ctx = createContext<DensityCtx>({ density: 'comfortable', setDensity: () => {}, toggle: () => {} });
export const useDensity = () => useContext(Ctx);

const KEY = 'taxiq.density';

/** Qlobal cədvəl sıxlığı (comfortable/compact) — data-density atributu ilə CSS-ə ötürülür */
export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<Density>('comfortable');
  useEffect(() => {
    try { const s = localStorage.getItem(KEY) as Density | null; if (s === 'compact' || s === 'comfortable') setDensityState(s); } catch { /* ignore */ }
  }, []);
  useEffect(() => { document.documentElement.setAttribute('data-density', density); }, [density]);
  const setDensity = (d: Density) => { setDensityState(d); try { localStorage.setItem(KEY, d); } catch { /* ignore */ } };
  return <Ctx.Provider value={{ density, setDensity, toggle: () => setDensity(density === 'compact' ? 'comfortable' : 'compact') }}>{children}</Ctx.Provider>;
}
