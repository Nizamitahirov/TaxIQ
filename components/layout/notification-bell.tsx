'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { listNotifications } from '@/lib/firebase/notifications';
import { Button } from '@/components/ui/button';

export function NotificationBell() {
  const { profile } = useAuth();
  const { data } = useQuery({
    queryKey: ['notifications', profile?.uid],
    queryFn: () => listNotifications(profile!.uid),
    enabled: !!profile?.uid,
  });
  const unread = (data ?? []).filter((n) => !n.isRead).length;

  return (
    <Button variant="ghost" size="icon" asChild className="relative" aria-label="Bildirişlər">
      <Link href="/notifications">
        <Bell />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Link>
    </Button>
  );
}
