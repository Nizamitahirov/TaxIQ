import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirebaseStorage } from './config';

export interface UploadedFile { url: string; storagePath: string; size: number; mimeType: string; fileName: string }

/** Verilmiş promise müəyyən vaxtda bitməzsə xəta atır (sonsuz «fırlanma»nın qarşısını alır). */
function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

/** Faylı Cloud Storage-ə yükləyir (client-side, Cloud Functions tələb etmir). */
export async function uploadFile(companyId: string, prefix: string, file: File): Promise<UploadedFile> {
  const storage = getFirebaseStorage();
  const safe = file.name.replace(/[^\w.\-() ]+/g, '_');
  const storagePath = `companies/${companyId}/${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;
  const r = ref(storage, storagePath);
  const timeoutMsg = 'Yükləmə vaxtı bitdi. Cloud Storage əlçatan olmaya bilər (CORS/konfiqurasiya). Yenidən cəhd edin.';
  await withTimeout(uploadBytes(r, file, { contentType: file.type || 'application/octet-stream' }), 45000, timeoutMsg);
  const url = await withTimeout(getDownloadURL(r), 20000, timeoutMsg);
  return { url, storagePath, size: file.size, mimeType: file.type || 'application/octet-stream', fileName: file.name };
}

export async function deleteStorageFile(storagePath: string): Promise<void> {
  try { await deleteObject(ref(getFirebaseStorage(), storagePath)); } catch { /* fayl artıq yoxdursa keç */ }
}
