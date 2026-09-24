'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, ShieldOff } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { logout } from '@/lib/firebase/auth';
import { useTT } from '@/lib/i18n/tt';
import { Button } from '@/components/ui/button';
import { Sidebar } from '@/components/layout/sidebar';
import { AreaRail } from '@/components/layout/area-rail';
import { MobileTabbar } from '@/components/layout/mobile-tabbar';
import { Topbar } from '@/components/layout/topbar';
import { ShellProvider } from '@/components/shell/shell-provider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading, mustChangePassword, accountDisabled } = useAuth();
  const tt = useTT();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Launcher (hub) səhifəsində sol naviqasiya göstərilmir — modula keçəndən sonra görünür
  const hideNav = pathname === '/launch';

  // Route guard — 01 §3.2 / §3.3
  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) { router.replace('/login'); return; }
    if (mustChangePassword) { router.replace('/change-password'); }
  }, [loading, firebaseUser, mustChangePassword, router]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  if (loading || !firebaseUser || mustChangePassword) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Deaktiv edilmiş hesab — girişi bloklanır (01 §3.4)
  if (accountDisabled) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger"><ShieldOff className="h-7 w-7" /></span>
        <div>
          <p className="text-lg font-semibold">{tt('Hesab deaktiv edilib', 'Account disabled')}</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{tt('Hesabınız administrator tərəfindən deaktiv edilib. Zəhmət olmasa administratorla əlaqə saxlayın.', 'Your account has been disabled by an administrator. Please contact your administrator.')}</p>
        </div>
        <Button variant="outline" onClick={() => logout(firebaseUser).then(() => router.replace('/login'))}>{tt('Çıxış', 'Sign out')}</Button>
      </div>
    );
  }

  return (
    <ShellProvider>
      <div className="flex min-h-screen bg-background">
        {/* Desktop: iki səviyyəli naviqasiya (Area Rail + kontekstual Sidebar) */}
        {!hideNav && (
          <div className="sticky top-0 hidden h-screen shrink-0 lg:flex">
            <AreaRail />
            <aside className="w-60 border-r border-sidebar-border bg-sidebar">
              <Sidebar hideHeader />
            </aside>
          </div>
        )}

        {/* Mobil çekmecə: rail + sidebar */}
        {!hideNav && mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0" onClick={() => setMobileOpen(false)} />
            <div className="absolute left-0 top-0 flex h-full animate-in slide-in-from-left">
              <AreaRail onNavigate={() => setMobileOpen(false)} />
              <aside className="h-full w-60 bg-sidebar shadow-xl">
                <Sidebar hideHeader onNavigate={() => setMobileOpen(false)} />
              </aside>
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenuClick={() => setMobileOpen(true)} showMenuButton={!hideNav} />
          <main className="flex-1 p-4 pb-24 lg:p-6 lg:pb-6">
            <div className="mx-auto w-full max-w-[1600px]">{children}</div>
          </main>
        </div>
      </div>
      <MobileTabbar />
    </ShellProvider>
  );
}
