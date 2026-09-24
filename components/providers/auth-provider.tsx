'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase/config';
import { fetchUserProfile } from '@/lib/firebase/auth';
import { resolveMemberships } from '@/lib/firebase/access';
import { canAccessModule, hasPermission, type ModuleKey } from '@/lib/rbac/permissions';
import type { ActiveMembership, AppUser } from '@/types';

const ACTIVE_KEY = 'taxiq.activeCompanyId';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: AppUser | null;
  loading: boolean;
  configured: boolean;
  isSuperAdmin: boolean;
  /** Bütün əlçatan membership-lər (Company Switcher üçün) */
  memberships: ActiveMembership[];
  activeCompanyId: string | null;
  active: ActiveMembership | null;
  mustChangePassword: boolean;
  /** Hesab deaktiv edilib (status: disabled) — giriş bloklanır */
  accountDisabled: boolean;
  switchCompany: (companyId: string) => void;
  can: (permId: string) => boolean;
  canAccess: (module: ModuleKey) => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [memberships, setMemberships] = useState<ActiveMembership[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const p = await fetchUserProfile(uid);
    setProfile(p);
    if (!p) {
      setMemberships([]);
      return;
    }
    // Deaktiv edilmiş hesab modullara giriş əldə etməməlidir (01 §3.4)
    if (p.status === 'disabled') {
      setMemberships([]);
      setActiveCompanyId(null);
      return;
    }
    const mems = await resolveMemberships(p);
    setMemberships(mems);

    // Aktiv şirkəti bərpa et / seç
    const stored = typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_KEY) : null;
    const valid = mems.find((m) => m.companyId === stored);
    const chosen = valid?.companyId ?? mems[0]?.companyId ?? null;
    setActiveCompanyId(chosen);
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          await loadProfile(user.uid);
        } catch (e) {
          console.error('Profil yüklənmədi', e);
        }
      } else {
        setProfile(null);
        setMemberships([]);
        setActiveCompanyId(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [loadProfile]);

  const switchCompany = useCallback((companyId: string) => {
    setActiveCompanyId(companyId);
    try { localStorage.setItem(ACTIVE_KEY, companyId); } catch { /* ignore */ }
  }, []);

  const active = useMemo(
    () => memberships.find((m) => m.companyId === activeCompanyId) ?? null,
    [memberships, activeCompanyId],
  );

  const isSuperAdmin = profile?.userType === 'platform_super_admin';

  const can = useCallback(
    (permId: string) => {
      if (isSuperAdmin) return true;
      return hasPermission(active?.permissions, permId);
    },
    [isSuperAdmin, active],
  );

  const canAccess = useCallback(
    (module: ModuleKey) => {
      if (isSuperAdmin) return true;
      return canAccessModule(active?.permissions, module);
    },
    [isSuperAdmin, active],
  );

  const value: AuthContextValue = {
    firebaseUser,
    profile,
    loading,
    configured: isFirebaseConfigured,
    isSuperAdmin: !!isSuperAdmin,
    memberships,
    activeCompanyId,
    active,
    mustChangePassword: !!profile?.mustChangePassword,
    accountDisabled: profile?.status === 'disabled',
    switchCompany,
    can,
    canAccess,
    refresh: async () => { if (firebaseUser) await loadProfile(firebaseUser.uid); },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth AuthProvider daxilində istifadə olunmalıdır');
  return ctx;
}
