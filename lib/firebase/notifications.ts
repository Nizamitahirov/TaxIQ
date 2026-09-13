import { where, orderBy } from 'firebase/firestore';
import { listDocs, updateDocById } from './firestore';
import type { Notification } from '@/types';

export async function listNotifications(userId: string): Promise<Notification[]> {
  return listDocs<Notification>('notifications', [
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  ]);
}

export async function markNotificationRead(id: string): Promise<void> {
  return updateDocById('notifications', id, { isRead: true });
}
