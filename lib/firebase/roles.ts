import { where } from 'firebase/firestore';
import { listDocs, getDocById, createDoc, updateDocById, deleteDocById } from './firestore';
import type { Role } from '@/types';

export async function getRole(id: string): Promise<Role | null> {
  return getDocById<Role>('roles', id);
}

/** Sistem rolları + verilmiş şirkətin fərdi rolları — 01 §4 */
export async function listRolesForCompany(companyId: string | null): Promise<Role[]> {
  const system = await listDocs<Role>('roles', [where('type', '==', 'system')]);
  if (!companyId) return system;
  const custom = await listDocs<Role>('roles', [where('companyId', '==', companyId)]);
  return [...system, ...custom];
}

export async function createRole(data: Omit<Role, 'id'>): Promise<string> {
  return createDoc('roles', data);
}

export async function updateRole(id: string, data: Partial<Role>): Promise<void> {
  return updateDocById('roles', id, data);
}

export async function deleteRole(id: string): Promise<void> {
  return deleteDocById('roles', id);
}
