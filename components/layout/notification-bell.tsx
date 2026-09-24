'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Bell, CheckCircle2, Inbox, ArrowRight } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { listNotifications } from '@/lib/firebase/notifications';
import { listApprovalTasks } from '@/lib/firebase/workflow';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils/cn';
import { useTT } from '@/lib/i18n/tt';

export function NotificationBell() {
  const { profile, active, isSuperAdmin } = useAuth();
  const tt = useTT();
  const companyId = active?.companyId;

  const { data: notifs } = useQuery({ queryKey: ['notifications', profile?.uid], queryFn: () => listNotifications(profile!.uid), enabled: !!profile?.uid });
  const { data: approvals } = useQuery({ queryKey: ['approvalTasks', companyId], queryFn: () => listApprovalTasks(companyId!), enabled: !!companyId });

  const unread = (notifs ?? []).filter((n) => !n.isRead);
  const pending = (approvals ?? []).filter((a) => a.status === 'pending' && (isSuperAdmin || a.approverRoleId === active?.roleId));
  const badge = unread.length + pending.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={tt('Bildirişlər', 'Notifications')}>
          <Bell />
          {badge > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <p className="text-sm font-semibold">{tt('Bildirişlər', 'Notifications')}</p>
          <Link href="/notifications" className="text-xs font-medium text-primary hover:underline">{tt('Hamısı', 'All')}</Link>
        </div>

        {pending.length > 0 && (
          <div className="border-b border-border">
            <p className="px-4 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{tt('Təsdiq gözləyir', 'Awaiting approval')} · {pending.length}</p>
            <div className="max-h-56 overflow-y-auto py-1">
              {pending.slice(0, 5).map((a) => (
                <Link key={a.id} href="/workflow" className="flex items-start gap-2.5 px-4 py-2 transition-colors hover:bg-secondary/60">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-warning/15 text-warning"><Inbox className="h-3.5 w-3.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{a.workflowName}</span>
                  </span>
                  <ArrowRight className="mt-1.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="max-h-64 overflow-y-auto py-1">
          {(notifs ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-8 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 text-success/70" /> {tt('Hər şey qaydasındadır', 'All caught up')}
            </div>
          ) : (notifs ?? []).slice(0, 8).map((n) => (
            <Link key={n.id} href="/notifications" className={cn('flex items-start gap-2.5 px-4 py-2 transition-colors hover:bg-secondary/60', !n.isRead && 'bg-primary/[0.04]')}>
              <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.isRead ? 'bg-transparent' : 'bg-primary')} />
              <span className="min-w-0 flex-1">
                <span className={cn('block truncate text-sm', !n.isRead && 'font-medium')}>{n.title}</span>
                {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
              </span>
            </Link>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
