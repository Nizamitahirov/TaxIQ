'use client';

/** Sənəd Kitabxanası (DMS) — faylların Storage-ə yüklənməsi + reyestr. Cloud Functions tələb etmir. */
import { listByCompanySorted, createDoc, deleteDocById } from './firestore';
import { uploadFile, deleteStorageFile } from './storage';
import { logAudit } from './audit';
import type { LibraryDocument, DocLibraryCategory } from '@/types';

export const listLibraryDocuments = (companyId: string) =>
  listByCompanySorted<LibraryDocument>('libraryDocuments', companyId, 'createdAt', 'desc');

export async function uploadLibraryDocument(input: {
  companyId: string; title: string; category: DocLibraryCategory; file: File;
  linkedEntityType?: string | null; linkedEntityId?: string | null; tags?: string[]; notes?: string | null; uploadedBy: string;
}): Promise<string> {
  const up = await uploadFile(input.companyId, `library/${input.category}`, input.file);
  const id = await createDoc('libraryDocuments', {
    companyId: input.companyId, title: input.title.trim() || up.fileName, category: input.category,
    fileName: up.fileName, fileUrl: up.url, storagePath: up.storagePath, size: up.size, mimeType: up.mimeType,
    linkedEntityType: input.linkedEntityType ?? null, linkedEntityId: input.linkedEntityId ?? null,
    tags: input.tags ?? [], notes: input.notes ?? null, uploadedBy: input.uploadedBy,
  });
  await logAudit({ companyId: input.companyId, userId: input.uploadedBy, action: 'DOCUMENT_UPLOADED', entityType: 'libraryDocument', entityId: id, after: { title: input.title, category: input.category, size: up.size } });
  return id;
}

export async function deleteLibraryDocument(doc: LibraryDocument, actorUid: string): Promise<void> {
  await deleteStorageFile(doc.storagePath);
  await deleteDocById('libraryDocuments', doc.id);
  await logAudit({ companyId: doc.companyId, userId: actorUid, action: 'DOCUMENT_DELETED', entityType: 'libraryDocument', entityId: doc.id, before: { title: doc.title } });
}
