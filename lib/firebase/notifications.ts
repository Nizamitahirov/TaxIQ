import { where } from 'firebase/firestore';
import { listDocs, updateDocById } from './firestore';
import type { Notification } from '@/types';

export async function listNotifications(userId: string): Promise<Notification[]> {
  // Composite index tələb etməmək üçün klient tərəfdə sıralanır
  const rows = await listDocs<Notification>('notifications', [where('userId', '==', userId)]);
  return rows.sort((a, b) => {
    const av = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
    const bv = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
    return bv - av;
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  return updateDocById('notifications', id, { isRead: true });
}
