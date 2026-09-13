import { where } from 'firebase/firestore';
import { listDocs, getDocById, setDocById, updateDocById } from './firestore';
import type { AppUser, UserCompanyAccess } from '@/types';

export async function listUsers(): Promise<AppUser[]> {
  return listDocs<AppUser>('users');
}

export async function getUser(uid: string): Promise<AppUser | null> {
  return getDocById<AppUser>('users', uid);
}

export async function upsertUser(uid: string, data: Partial<AppUser>): Promise<void> {
  return setDocById('users', uid, data as Record<string, unknown>);
}

export async function updateUser(uid: string, data: Partial<AppUser>): Promise<void> {
  return updateDocById('users', uid, data as Record<string, unknown>);
}

// ── userCompanyAccess (Staff↔Company↔Rol) — 01 §2.5 ──
export async function listAccessForUser(userId: string): Promise<UserCompanyAccess[]> {
  return listDocs<UserCompanyAccess>('userCompanyAccess', [
    where('userId', '==', userId),
    where('status', '==', 'active'),
  ]);
}

export async function listAccessForCompany(companyId: string): Promise<UserCompanyAccess[]> {
  return listDocs<UserCompanyAccess>('userCompanyAccess', [
    where('companyId', '==', companyId),
    where('status', '==', 'active'),
  ]);
}
