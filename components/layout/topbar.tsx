'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { LogOut, Menu, Settings, User, Search, Keyboard, Compass } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { logout } from '@/lib/firebase/auth';
import { useShell } from '@/components/shell/shell-provider';
import { usePeriod } from '@/components/providers/period-provider';
import { useDensity } from '@/components/providers/density-provider';
import { Rows3, Rows4 } from 'lucide-react';
import { Breadcrumbs } from '@/components/shell/breadcrumbs';
import { CreateMenu } from '@/components/shell/create-menu';
import { CalendarRange } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Logo } from './logo';
import { CompanySwitcher } from './company-switcher';
import { LocaleSwitcher } from './locale-switcher';
import { NotificationBell } from './notification-bell';
import { ThemeToggle } from './theme-toggle';

export function Topbar({ onMenuClick, showMenuButton = true }: { onMenuClick: () => void; showMenuButton?: boolean }) {
  const t = useTranslations('common');
  const router = useRouter();
  const { profile, firebaseUser, active } = useAuth();
  const { openPalette, openHelp, openTour } = useShell();
  const { year, setYear } = usePeriod();
  const { density, toggle: toggleDensity } = useDensity();
  const nowYear = new Date().getFullYear();

  const name = profile?.displayName || firebaseUser?.email || 'İstifadəçi';
  const initials = name.slice(0, 2).toUpperCase();

  async function handleLogout() {
    await logout(firebaseUser);
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md lg:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        {showMenuButton && <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Menyu"><Menu /></Button>}
        <span className="lg:hidden"><Logo compact /></span>
        <CompanySwitcher />
        <span className="hidden h-5 w-px bg-border md:block" />
        <Breadcrumbs />
      </div>

      <div className="flex items-center gap-1.5">
        <button onClick={() => openPalette('all')} aria-label="Axtar (⌘K)"
          className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary md:flex">
          <Search className="h-4 w-4" /> <span>Axtar…</span>
          <kbd className="ml-2 rounded border border-border bg-background px-1.5 text-[10px] font-medium">⌘K</kbd>
        </button>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => openPalette('all')} aria-label="Axtar"><Search className="h-5 w-5" /></Button>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="hidden h-9 w-[104px] gap-1.5 lg:flex" aria-label="Hesabat dövrü"><CalendarRange className="h-4 w-4 text-muted-foreground" /><SelectValue /></SelectTrigger>
          <SelectContent>{[0, 1, 2, 3].map((i) => <SelectItem key={i} value={String(nowYear - i)}>{nowYear - i}</SelectItem>)}</SelectContent>
        </Select>
        <CreateMenu />
        <ThemeToggle />
        <LocaleSwitcher />
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <Avatar className="h-8 w-8">
                {profile?.avatarUrl && <AvatarImage src={profile.avatarUrl} alt={name} />}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium leading-none">{name}</p>
                <p className="text-xs text-muted-foreground">{active?.roleName ?? profile?.userType}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-semibold">{name}</p>
              <p className="text-xs font-normal text-muted-foreground">{active?.roleName ?? profile?.userType}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/profile"><User className="h-4 w-4" /> {t('profile')}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/settings"><Settings className="h-4 w-4" /> {t('settings')}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.preventDefault(); toggleDensity(); }}>
              {density === 'compact' ? <Rows4 className="h-4 w-4" /> : <Rows3 className="h-4 w-4" />}
              {density === 'compact' ? 'Rahat görünüş' : 'Sıx görünüş'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(e) => { e.preventDefault(); openTour(); }}><Compass className="h-4 w-4" /> Təqdimat turu</DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.preventDefault(); openHelp(); }}><Keyboard className="h-4 w-4" /> Qısayollar</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-danger">
              <LogOut className="h-4 w-4" /> {t('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
