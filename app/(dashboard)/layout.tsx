'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { Sidebar } from '@/components/layout/sidebar';
import { AreaRail } from '@/components/layout/area-rail';
import { Topbar } from '@/components/layout/topbar';
import { ShellProvider } from '@/components/shell/shell-provider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { firebaseUser, loading, mustChangePassword } = useAuth();
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
          <main className="flex-1 p-4 lg:p-6">
            <div className="mx-auto w-full max-w-[1600px]">{children}</div>
          </main>
        </div>
      </div>
    </ShellProvider>
  );
}
