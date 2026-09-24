'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { listNotifications, markNotificationRead } from '@/lib/firebase/notifications';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { useTT } from '@/lib/i18n/tt';

export default function NotificationsPage() {
  const { profile } = useAuth();
  const tt = useTT();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', profile?.uid],
    queryFn: () => listNotifications(profile!.uid),
    enabled: !!profile?.uid,
  });

  async function markRead(id: string) {
    await markNotificationRead(id);
    qc.invalidateQueries({ queryKey: ['notifications', profile?.uid] });
  }

  return (
    <div>
      <PageHeader title={tt('Bildirişlər', 'Notifications')} subtitle={tt('Sistem və workflow bildirişləri (01 §9)', 'System and workflow notifications (01 §9)')} />
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data || data.length === 0 ? (
        <EmptyState title={tt('Bildiriş yoxdur', 'No notifications')} />
      ) : (
        <div className="space-y-2">
          {data.map((n) => (
            <Card key={n.id} className={cn('rounded-card', !n.isRead && 'border-primary/30 bg-primary/5')}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{n.title}</p>
                  <p className="text-sm text-muted-foreground">{n.body}</p>
                </div>
                {!n.isRead && <Button variant="ghost" size="sm" onClick={() => markRead(n.id)}><Check className="h-4 w-4" /> {tt('Oxundu', 'Read')}</Button>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
