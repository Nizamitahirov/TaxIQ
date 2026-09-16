import { createUserWithEmailAndPassword } from 'firebase/auth';
import {
  addDoc, collection, doc, serverTimestamp, setDoc, updateDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { getDb, getSecondaryAuth } from './config';
import { normalizeLogin, sendPasswordReset } from './auth';
import { logAudit } from './audit';
import type { AppUser, UserStatus, UserType } from '@/types';

/** Müvəqqəti parol generasiyası — 01 §3.3 (min 10 simvol, qarışıq) */
export function generateTempPassword(length = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%*?';
  const all = upper + lower + digits + special;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let pw = pick(upper) + pick(lower) + pick(digits) + pick(special);
  for (let i = pw.length; i < length; i++) pw += pick(all);
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

export interface CreateUserInput {
  displayName: string;
  /** email və ya istifadəçi adı (admin kimi) */
  identifier: string;
  userType: UserType;
  /** client_user üçün məcburi; staff üçün opsional ilkin təyinat */
  companyId?: string | null;
  roleId?: string | null;
  phone?: string | null;
  createdBy: string;
}

export interface CreateUserResult {
  uid: string;
  email: string;
  tempPassword: string;
}

/**
 * Yeni istifadəçi yaradır — 01 §3.3.
 * Secondary Firebase app istifadə olunur ki, cari admin sessiyası əvəz olunmasın.
 * Müvəqqəti parol qaytarılır (ekranda bir dəfə göstərilir) — mustChangePassword: true.
 */
export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const email = normalizeLogin(input.identifier);
  const tempPassword = generateTempPassword();
  const { auth, cleanup } = getSecondaryAuth();

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, tempPassword);
    const uid = cred.user.uid;

    const profile: Partial<AppUser> = {
      email,
      displayName: input.displayName,
      userType: input.userType,
      status: 'active',
      mustChangePassword: true,
      homeCompanyId: input.userType === 'client_user' ? (input.companyId ?? null) : null,
      accessibleCompanyIds: input.companyId ? [input.companyId] : [],
      phone: input.phone ?? null,
      preferredLanguage: 'az',
      preferredTheme: 'system',
      createdBy: input.createdBy,
    };
    await setDoc(doc(getDb(), 'users', uid), {
      ...profile,
      temporaryPasswordIssuedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // İlkin şirkət təyinatı
    if (input.companyId && input.roleId) {
      await addDoc(collection(getDb(), 'userCompanyAccess'), {
        userId: uid,
        companyId: input.companyId,
        roleId: input.roleId,
        customPermissionOverrides: { add: [], remove: [] },
        departmentScope: null,
        status: 'active',
        assignedBy: input.createdBy,
        assignedAt: serverTimestamp(),
      });
    }

    await logAudit({
      companyId: input.companyId ?? null,
      userId: input.createdBy,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: uid,
      after: { email, userType: input.userType },
    });

    return { uid, email, tempPassword };
  } finally {
    // Secondary session-u bağla (admin sessiyasına təsir etməsin)
    try { await auth.signOut(); } catch { /* ignore */ }
    await cleanup();
  }
}

/** İstifadəçi profilini yenilə (ad, telefon, tip) — 01 §3.4. */
export async function updateUserAdmin(params: {
  userId: string;
  patch: { displayName?: string; phone?: string | null; userType?: UserType };
  actorUid: string;
}): Promise<void> {
  await updateDoc(doc(getDb(), 'users', params.userId), {
    ...params.patch,
    updatedAt: serverTimestamp(),
  });
  await logAudit({
    companyId: null, userId: params.actorUid, action: 'USER_UPDATED',
    entityType: 'user', entityId: params.userId, after: params.patch as Record<string, unknown>,
  });
}

/** İstifadəçi statusunu dəyiş (active/disabled/invited) — 01 §3.4. */
export async function setUserStatus(params: {
  userId: string; status: UserStatus; actorUid: string;
}): Promise<void> {
  await updateDoc(doc(getDb(), 'users', params.userId), {
    status: params.status, updatedAt: serverTimestamp(),
  });
  await logAudit({
    companyId: null, userId: params.actorUid,
    action: params.status === 'disabled' ? 'USER_DISABLED' : 'USER_STATUS_CHANGED',
    entityType: 'user', entityId: params.userId, after: { status: params.status },
  });
}

/** Növbəti girişdə parol dəyişməyi məcbur et — 01 §3.3. */
export async function requirePasswordChange(userId: string, actorUid: string): Promise<void> {
  await updateDoc(doc(getDb(), 'users', userId), {
    mustChangePassword: true, updatedAt: serverTimestamp(),
  });
  await logAudit({
    companyId: null, userId: actorUid, action: 'USER_PASSWORD_CHANGE_REQUIRED',
    entityType: 'user', entityId: userId,
  });
}

/** İstifadəçiyə parol sıfırlama e-poçtu göndər (Firebase Auth) — 01 §3.3. */
export async function sendUserPasswordReset(email: string, userId: string, actorUid: string): Promise<void> {
  await sendPasswordReset(email);
  await logAudit({
    companyId: null, userId: actorUid, action: 'USER_PASSWORD_RESET_SENT',
    entityType: 'user', entityId: userId, after: { email },
  });
}

/** Mövcud şirkət təyinatını yenilə (rol + icazə override + şöbə əhatəsi) — 01 §2.5. */
export async function updateAccessAssignment(params: {
  accessId: string; userId: string; companyId: string;
  roleId?: string;
  customPermissionOverrides?: { add: string[]; remove: string[] };
  departmentScope?: string[] | null;
  actorUid: string;
}): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (params.roleId !== undefined) patch.roleId = params.roleId;
  if (params.customPermissionOverrides !== undefined) patch.customPermissionOverrides = params.customPermissionOverrides;
  if (params.departmentScope !== undefined) patch.departmentScope = params.departmentScope;
  await updateDoc(doc(getDb(), 'userCompanyAccess', params.accessId), patch);
  await logAudit({
    companyId: params.companyId, userId: params.actorUid, action: 'USER_ACCESS_UPDATED',
    entityType: 'userCompanyAccess', entityId: params.accessId,
    after: { roleId: params.roleId, overrides: params.customPermissionOverrides },
  });
}

/** Staff-ı şirkətə təyin et (rol ilə) — 01 §2.5. accessibleCompanyIds sinxronlaşır. */
export async function assignUserToCompany(params: {
  userId: string; companyId: string; roleId: string; assignedBy: string;
}): Promise<void> {
  await addDoc(collection(getDb(), 'userCompanyAccess'), {
    userId: params.userId,
    companyId: params.companyId,
    roleId: params.roleId,
    customPermissionOverrides: { add: [], remove: [] },
    departmentScope: null,
    status: 'active',
    assignedBy: params.assignedBy,
    assignedAt: serverTimestamp(),
  });
  await updateDoc(doc(getDb(), 'users', params.userId), {
    accessibleCompanyIds: arrayUnion(params.companyId),
    updatedAt: serverTimestamp(),
  });
  await logAudit({
    companyId: params.companyId, userId: params.assignedBy,
    action: 'USER_ASSIGNED_COMPANY', entityType: 'userCompanyAccess', entityId: params.userId,
    after: { companyId: params.companyId, roleId: params.roleId },
  });
}

/** Təyinatı ləğv et — 01 §2.5. */
export async function revokeAccess(params: {
  accessId: string; userId: string; companyId: string; revokedBy: string;
}): Promise<void> {
  await updateDoc(doc(getDb(), 'userCompanyAccess', params.accessId), {
    status: 'revoked', updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(getDb(), 'users', params.userId), {
    accessibleCompanyIds: arrayRemove(params.companyId),
    updatedAt: serverTimestamp(),
  });
  await logAudit({
    companyId: params.companyId, userId: params.revokedBy,
    action: 'USER_ACCESS_REVOKED', entityType: 'userCompanyAccess', entityId: params.accessId,
  });
}
