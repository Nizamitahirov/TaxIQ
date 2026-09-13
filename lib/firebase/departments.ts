import { where } from 'firebase/firestore';
import { listByCompany, createDoc, updateDocById, deleteDocById } from './firestore';
import type { Department } from '@/types';

export async function listDepartments(companyId: string): Promise<Department[]> {
  return listByCompany<Department>('departments', companyId);
}

export async function createDepartment(data: Omit<Department, 'id'>): Promise<string> {
  return createDoc('departments', data as Record<string, unknown>);
}

export async function updateDepartment(id: string, data: Partial<Department>): Promise<void> {
  return updateDocById('departments', id, data as Record<string, unknown>);
}

export async function deleteDepartment(id: string): Promise<void> {
  return deleteDocById('departments', id);
}

export { where };
