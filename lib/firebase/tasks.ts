import { where, orderBy } from 'firebase/firestore';
import { listByCompany, createDoc, updateDocById, deleteDocById } from './firestore';
import { serverTimestamp } from 'firebase/firestore';
import type { UserTask } from '@/types';

/** İstifadəçinin öz tapşırıqları (kiçik task management) */
export async function listMyTasks(companyId: string, uid: string): Promise<UserTask[]> {
  const rows = await listByCompany<UserTask>('userTasks', companyId, [where('assignedToUid', '==', uid), orderBy('createdAt', 'desc')]);
  return rows;
}

export async function createTask(input: {
  companyId: string; title: string; priority: UserTask['priority']; dueDate?: string | null; assignedToUid: string; createdBy: string;
}): Promise<string> {
  return createDoc('userTasks', {
    companyId: input.companyId, title: input.title.trim(), done: false,
    priority: input.priority, dueDate: input.dueDate ?? null,
    assignedToUid: input.assignedToUid, createdBy: input.createdBy, completedAt: null,
  });
}

export async function toggleTask(t: UserTask): Promise<void> {
  await updateDocById('userTasks', t.id, { done: !t.done, completedAt: !t.done ? serverTimestamp() : null });
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDocById('userTasks', id);
}

/** Tamamlanma faizi (profil ring üçün) */
export function completionPercent(tasks: UserTask[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
}
