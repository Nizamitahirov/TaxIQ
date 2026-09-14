/**
 * Giriş cəhdi məhdudiyyəti — 01 §3.1: 5 ardıcıl uğursuz cəhddən sonra 15 dəqiqəlik kilid.
 *
 * Bu, Firebase Auth-un öz throttling-inə **əlavə cihaz-səviyyəli qatdır** (localStorage).
 * Server-səviyyəli tam qoruma üçün Cloud Function + Firestore `loginAttempts` tələb olunur
 * (spesifikasiyada qeyd olunduğu kimi) — bu MVP cihazda qorunma verir.
 */
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000; // 15 dəqiqə
const PREFIX = 'taxiq_login_';

interface AttemptState { count: number; lockedUntil: number }

function keyFor(identifier: string): string {
  return PREFIX + identifier.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
}

function read(identifier: string): AttemptState {
  try {
    const raw = localStorage.getItem(keyFor(identifier));
    if (!raw) return { count: 0, lockedUntil: 0 };
    return JSON.parse(raw) as AttemptState;
  } catch {
    return { count: 0, lockedUntil: 0 };
  }
}

function write(identifier: string, state: AttemptState): void {
  try { localStorage.setItem(keyFor(identifier), JSON.stringify(state)); } catch { /* ignore */ }
}

export interface LockStatus { locked: boolean; remainingMs: number; attemptsLeft: number }

/** Cari kilid vəziyyətini qaytarır (giriş cəhdindən əvvəl yoxlanılır) */
export function checkLockout(identifier: string): LockStatus {
  const s = read(identifier);
  const now = Date.now();
  if (s.lockedUntil > now) {
    return { locked: true, remainingMs: s.lockedUntil - now, attemptsLeft: 0 };
  }
  return { locked: false, remainingMs: 0, attemptsLeft: Math.max(0, MAX_ATTEMPTS - s.count) };
}

/** Uğursuz cəhdi qeyd edir və yeni kilid vəziyyətini qaytarır */
export function recordFailure(identifier: string): LockStatus {
  const s = read(identifier);
  const now = Date.now();
  // Köhnə kilid bitibsə sıfırla
  const base = s.lockedUntil && s.lockedUntil <= now ? { count: 0, lockedUntil: 0 } : s;
  const count = base.count + 1;
  const lockedUntil = count >= MAX_ATTEMPTS ? now + LOCK_MS : 0;
  write(identifier, { count, lockedUntil });
  return { locked: lockedUntil > now, remainingMs: lockedUntil > now ? lockedUntil - now : 0, attemptsLeft: Math.max(0, MAX_ATTEMPTS - count) };
}

/** Uğurlu girişdən sonra sayğacı təmizləyir */
export function clearAttempts(identifier: string): void {
  try { localStorage.removeItem(keyFor(identifier)); } catch { /* ignore */ }
}

export function formatRemaining(ms: number): string {
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m} dəq ${s} san` : `${s} san`;
}
