import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDb } from './config';

interface AuditInput {
  companyId?: string | null;
  userId: string;
  userDisplayName?: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}

/** Audit jurnalına yazır — 01 §10. Xəta halında səssizcə ötür (əsas axını bloklamasın). */
export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await addDoc(collection(getDb(), 'auditLogs'), {
      ...input,
      companyId: input.companyId ?? null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      timestamp: serverTimestamp(),
    });
  } catch {
    /* audit yazısı uğursuz oldu — kritik deyil */
  }
}
