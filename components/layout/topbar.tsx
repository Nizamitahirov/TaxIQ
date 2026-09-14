'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { LogOut, Menu, Settings, User } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { logout } from '@/lib/firebase/auth';
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

  const name = profile?.displayName || firebaseUser?.email || 'İstifadəçi';
  const initials = name.slice(0, 2).toUpperCase();

  async function handleLogout() {
    await logout(firebaseUser);
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur-md lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {showMenuButton && <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick} aria-label="Menyu"><Menu /></Button>}
        <span className="lg:hidden"><Logo compact /></span>
        <CompanySwitcher />
      </div>

      <div className="flex items-center gap-1.5">
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
