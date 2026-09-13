import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type QueryConstraint,
} from 'firebase/firestore';
import { getDb } from './config';

/** Sənədləri (id ilə) gətirir */
export async function listDocs<T>(
  path: string,
  constraints: QueryConstraint[] = [],
): Promise<T[]> {
  const q = query(collection(getDb(), path), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as T[];
}

/**
 * Çoxmüştərili (multi-tenant) sorğu — 01 §2.2.
 * HƏR biznes sorğusu MÜTLƏQ companyId filtri ilə qurulur.
 */
export async function listByCompany<T>(
  path: string,
  companyId: string,
  extra: QueryConstraint[] = [],
): Promise<T[]> {
  return listDocs<T>(path, [where('companyId', '==', companyId), ...extra]);
}

export async function getDocById<T>(path: string, id: string): Promise<T | null> {
  const snap = await getDoc(doc(getDb(), path, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as object) } as T;
}

export async function createDoc(path: string, data: Record<string, unknown>): Promise<string> {
  const ref = await addDoc(collection(getDb(), path), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/** Sabit id ilə sənəd yaradır/əvəz edir */
export async function setDocById(path: string, id: string, data: Record<string, unknown>): Promise<void> {
  await setDoc(doc(getDb(), path, id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function updateDocById(path: string, id: string, data: Record<string, unknown>): Promise<void> {
  await updateDoc(doc(getDb(), path, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteDocById(path: string, id: string): Promise<void> {
  await deleteDoc(doc(getDb(), path, id));
}

export { where, orderBy };
