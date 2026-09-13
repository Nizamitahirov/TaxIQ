import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  setPersistence,
  browserLocalPersistence,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getFirebaseAuth, getDb } from './config';
import { logAudit } from './audit';
import type { AppUser } from '@/types';

/**
 * İstifadəçi adı və ya e-poçtla giriş — 01 §3.1 / §3.2.
 * `admin` kimi istifadəçi adları daxili olaraq sintetik e-poçta map olunur.
 */
export function normalizeLogin(identifier: string): string {
  const v = identifier.trim();
  if (v.includes('@')) return v;
  return `${v.toLowerCase()}@taxiq.system`;
}

export async function loginWithEmail(identifier: string, password: string): Promise<FirebaseUser> {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  const email = normalizeLogin(identifier);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await afterLogin(cred.user);
  return cred.user;
}

async function afterLogin(user: FirebaseUser) {
  try {
    await updateDoc(doc(getDb(), 'users', user.uid), { lastLoginAt: serverTimestamp() });
  } catch {
    /* profil hələ yoxdursa ötür */
  }
  await logAudit({
    userId: user.uid,
    userDisplayName: user.email ?? user.uid,
    action: 'LOGIN_SUCCESS',
    entityType: 'auth',
    entityId: user.uid,
  });
}

export async function logout(user?: { uid: string; email?: string | null } | null): Promise<void> {
  if (user) {
    await logAudit({
      userId: user.uid,
      userDisplayName: user.email ?? user.uid,
      action: 'LOGOUT',
      entityType: 'auth',
      entityId: user.uid,
    });
  }
  await fbSignOut(getFirebaseAuth());
}

/** İlk giriş / məcburi parol dəyişikliyi — 01 §3.3 (addım 4-5) */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('İstifadəçi tapılmadı');

  // Təhlükəsizlik üçün yenidən autentifikasiya
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);

  await updateDoc(doc(getDb(), 'users', user.uid), {
    mustChangePassword: false,
    temporaryPasswordIssuedAt: null,
    updatedAt: serverTimestamp(),
  });
  await logAudit({
    userId: user.uid,
    userDisplayName: user.email,
    action: 'PASSWORD_CHANGED',
    entityType: 'auth',
    entityId: user.uid,
  });
}

/** Firestore-dan istifadəçi profilini gətirir */
export async function fetchUserProfile(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(getDb(), 'users', uid));
  if (!snap.exists()) return null;
  return { uid, ...(snap.data() as Omit<AppUser, 'uid'>) };
}
