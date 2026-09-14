import { where, orderBy, serverTimestamp } from 'firebase/firestore';
import { listByCompany, createDoc, updateDocById, deleteDocById } from './firestore';
import { listUsers, listAccessForCompany } from './users';
import type { UserTask, TaskStatus, AppUser } from '@/types';

/** İstifadəçiyə təyin olunmuş tapşırıqlar (launcher paneli + ring) */
export async function listMyTasks(companyId: string, uid: string): Promise<UserTask[]> {
  return listByCompany<UserTask>('userTasks', companyId, [where('assignedToUid', '==', uid), orderBy('createdAt', 'desc')]);
}

/** Şirkətin bütün tapşırıqları (komanda lövhəsi/hesabat) */
export async function listCompanyTasks(companyId: string): Promise<UserTask[]> {
  return listByCompany<UserTask>('userTasks', companyId, [orderBy('createdAt', 'desc')]);
}

export interface TaskInput {
  companyId: string; title: string; description?: string | null;
  status?: TaskStatus; priority: UserTask['priority']; dueDate?: string | null;
  labels?: string[]; assignedToUid: string; assigneeName?: string | null;
  createdBy: string; createdByName?: string | null;
}

export async function createTask(input: TaskInput): Promise<string> {
  const status = input.status ?? 'todo';
  return createDoc('userTasks', {
    companyId: input.companyId, title: input.title.trim(), description: input.description ?? null,
    status, done: status === 'done',
    priority: input.priority, dueDate: input.dueDate ?? null, labels: input.labels ?? [],
    assignedToUid: input.assignedToUid, assigneeName: input.assigneeName ?? null,
    createdBy: input.createdBy, createdByName: input.createdByName ?? null,
    order: Date.now(), completedAt: status === 'done' ? serverTimestamp() : null,
  });
}

export async function updateTask(id: string, patch: Partial<UserTask>): Promise<void> {
  await updateDocById('userTasks', id, patch as Record<string, unknown>);
}

/** Statusu dəyişir (kanban sürüşdürmə və ya seçim) — done güzgüsünü sinxronlaşdırır */
export async function setTaskStatus(id: string, status: TaskStatus): Promise<void> {
  await updateDocById('userTasks', id, { status, done: status === 'done', completedAt: status === 'done' ? serverTimestamp() : null });
}

/** Launcher-də sürətli tamamlama (done ↔ todo) */
export async function toggleTask(t: UserTask): Promise<void> {
  const done = !t.done;
  await updateDocById('userTasks', t.id, { done, status: done ? 'done' : 'todo', completedAt: done ? serverTimestamp() : null });
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDocById('userTasks', id);
}

/** Tamamlanma faizi (profil ring üçün) */
export function completionPercent(tasks: UserTask[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100);
}

export interface TeamMember { uid: string; name: string }

/**
 * Komanda üzvləri (təyinat üçün). Super admin bütün istifadəçiləri oxuya bilir;
 * adi üzvlər üçün Firestore qaydaları başqa istifadəçi sənədlərini bloklayır,
 * ona görə mövcud tapşırıqlardakı denormallaşdırılmış adlara + cari istifadəçiyə
 * geri qayıdırıq (təhlükəsiz degradasiya).
 */
export async function listTeamMembers(companyId: string, self: AppUser | null, tasks: UserTask[]): Promise<TeamMember[]> {
  const map = new Map<string, string>();
  if (self?.uid) map.set(self.uid, self.displayName || 'Mən');
  // Tapşırıqlardan bilinən adlar
  for (const t of tasks) {
    if (t.assignedToUid && t.assigneeName) map.set(t.assignedToUid, t.assigneeName);
    if (t.createdBy && t.createdByName) map.set(t.createdBy, t.createdByName);
  }
  // Tam siyahı (yalnız icazə varsa)
  try {
    const access = await listAccessForCompany(companyId);
    const memberIds = new Set(access.map((a) => a.userId));
    const users = await listUsers();
    for (const u of users) {
      if (memberIds.has(u.uid) || u.accessibleCompanyIds?.includes(companyId) || u.homeCompanyId === companyId) {
        map.set(u.uid, u.displayName || u.uid);
      }
    }
  } catch { /* icazə yoxdursa denormallaşdırılmış adlarla kifayətlənirik */ }
  return Array.from(map, ([uid, name]) => ({ uid, name })).sort((a, b) => a.name.localeCompare(b.name));
}
