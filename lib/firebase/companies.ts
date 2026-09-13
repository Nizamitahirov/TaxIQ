import { where } from 'firebase/firestore';
import { listDocs, getDocById } from './firestore';
import type { Company } from '@/types';

export async function getCompany(id: string): Promise<Company | null> {
  return getDocById<Company>('companies', id);
}

export async function listCompanies(): Promise<Company[]> {
  return listDocs<Company>('companies');
}

/** Verilmiş id-lərə uyğun şirkətlər (staff-in əlçatan şirkətləri) */
export async function getCompaniesByIds(ids: string[]): Promise<Company[]> {
  if (ids.length === 0) return [];
  // Firestore 'in' operatoru max 30 element — praktikada kifayət edir
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));
  const all: Company[] = [];
  for (const chunk of chunks) {
    all.push(...(await listDocs<Company>('companies', [where('__name__', 'in', chunk)])));
  }
  return all;
}
