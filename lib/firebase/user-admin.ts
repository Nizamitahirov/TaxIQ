import { createUserWithEmailAndPassword } from 'firebase/auth';
import {
  collection, doc, getDocs, query, where, serverTimestamp, setDoc, updateDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { getDb, getSecondaryAuth } from './config';
import { normalizeLogin, sendPasswordReset } from './auth';
import { logAudit } from './audit';
import { listUsers } from './users';
import type { AppUser, UserCompanyAccess, UserStatus, UserType } from '@/types';

/**
 * Staff↔Company təyinatının determinik sənəd id-si — `${userId}__${companyId}`.
 * Bu, təhlükəsizlik qaydalarının (firestore.rules) təyinatın mövcudluğunu birbaşa
 * `exists()` ilə yoxlamasına imkan verir və hər istifadəçi/şirkət üçün yeganə rol saxlayır.
 */
export function accessDocId(userId: string, companyId: string): string {
  return `${userId}__${companyId}`;
}

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

    // İlkin şirkət təyinatı (determinik id ilə — qayda `exists()` yoxlaya bilsin)
    if (input.companyId && input.roleId) {
      await setDoc(doc(getDb(), 'userCompanyAccess', accessDocId(uid, input.companyId)), {
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
  await setDoc(doc(getDb(), 'userCompanyAccess', accessDocId(params.userId, params.companyId)), {
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

// ════════════════════════════════════════════════════════════════════
//  Giriş bərpası / sinxronizasiyası (01 §2.5)
//  «Missing or insufficient permissions» xətasının kök səbəbi: users/{uid}
//  sənədindəki denormallaşdırılmış `accessibleCompanyIds` massivi ilə
//  `userCompanyAccess` (əsl mənbə) arasında uyğunsuzluq (drift). Aşağıdakı
//  funksiyalar hər ikisini yenidən uyğunlaşdırır. YALNIZ Super Admin çağıra
//  bilər (firestore.rules users update-i super admin-ə açır).
// ════════════════════════════════════════════════════════════════════

/** Bir istifadəçinin accessibleCompanyIds massivini `userCompanyAccess`-dən yenidən qurur. */
export async function resyncUserAccess(user: Pick<AppUser, 'uid' | 'userType' | 'homeCompanyId'>): Promise<string[]> {
  const snap = await getDocs(query(
    collection(getDb(), 'userCompanyAccess'),
    where('userId', '==', user.uid),
    where('status', '==', 'active'),
  ));
  const ids = new Set<string>();
  for (const d of snap.docs) {
    const data = d.data() as UserCompanyAccess;
    if (data.companyId) ids.add(data.companyId);
    // Determinik id-yə köçürmə (köhnə təsadüfi id-lər üçün)
    const wanted = accessDocId(user.uid, data.companyId);
    if (d.id !== wanted) {
      await setDoc(doc(getDb(), 'userCompanyAccess', wanted), { ...data }, { merge: true });
      await updateDoc(doc(getDb(), 'userCompanyAccess', d.id), { status: 'superseded', updatedAt: serverTimestamp() });
    }
  }
  // Client user öz ev şirkətinə də sahibdir
  if (user.userType === 'client_user' && user.homeCompanyId) ids.add(user.homeCompanyId);
  const list = [...ids];
  await updateDoc(doc(getDb(), 'users', user.uid), { accessibleCompanyIds: list, updatedAt: serverTimestamp() });
  return list;
}

/** Bütün istifadəçilər üçün giriş massivini yenidən qurur — Super Admin alət. */
export async function resyncAllAccess(actorUid: string): Promise<{ users: number }> {
  const users = await listUsers();
  let n = 0;
  for (const u of users) {
    if (u.userType === 'platform_super_admin') continue; // super admin bypass — massiv lazım deyil
    try { await resyncUserAccess(u); n++; } catch { /* bir istifadəçi digərlərini bloklamır */ }
  }
  await logAudit({
    companyId: null, userId: actorUid, action: 'ACCESS_RESYNCED', entityType: 'user', entityId: 'ALL',
    after: { users: n },
  });
  return { users: n };
}
