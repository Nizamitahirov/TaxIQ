'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, LogIn, Lock, Mail, User, Eye, EyeOff, ShieldCheck, BarChart3, FileSpreadsheet } from 'lucide-react';
import { loginWithEmail, sendPasswordReset } from '@/lib/firebase/auth';
import { checkLockout, recordFailure, clearAttempts, formatRemaining } from '@/lib/auth/lockout';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Logo, LogoMark } from '@/components/layout/logo';
import { toast } from '@/components/ui/toast';
import { useTT } from '@/lib/i18n/tt';

export default function LoginPage() {
  const t = useTranslations('auth');
  const tt = useTT();
  const router = useRouter();
  const { firebaseUser, configured, loading: authLoading, mustChangePassword } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lockMsg, setLockMsg] = useState('');
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && firebaseUser) {
      router.replace(mustChangePassword ? '/change-password' : '/launch');
    }
  }, [authLoading, firebaseUser, mustChangePassword, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      toast.error(t('notConfigured'), tt('NEXT_PUBLIC_FIREBASE_* dəyişənlərini əlavə edin', 'Add the NEXT_PUBLIC_FIREBASE_* variables'));
      return;
    }
    // Cihaz-səviyyəli kilid yoxlaması (01 §3.1)
    const lock = checkLockout(identifier);
    if (lock.locked) {
      const msg = tt(`Çox sayda uğursuz cəhd. ${formatRemaining(lock.remainingMs)} sonra yenidən cəhd edin.`, `Too many failed attempts. Try again in ${formatRemaining(lock.remainingMs)}.`);
      setLockMsg(msg); toast.error(tt('Giriş müvəqqəti bloklandı', 'Login temporarily blocked'), msg);
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(identifier, password);
      clearAttempts(identifier);
      setLockMsg('');
      toast.success(t('welcome'));
      router.replace('/launch');
    } catch {
      const st = recordFailure(identifier);
      if (st.locked) {
        const msg = tt(`5 uğursuz cəhd. Giriş ${formatRemaining(st.remainingMs)} müddətinə bloklandı.`, `5 failed attempts. Login is blocked for ${formatRemaining(st.remainingMs)}.`);
        setLockMsg(msg); toast.error(tt('Giriş bloklandı', 'Login blocked'), msg);
      } else {
        setLockMsg('');
        toast.error(t('invalidCredentials'), st.attemptsLeft <= 2 ? tt(`${st.attemptsLeft} cəhd qalıb`, `${st.attemptsLeft} attempt(s) left`) : undefined);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brend paneli (desktop) */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#1F5AEB] to-[#153E9E] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-black/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <LogoMark className="h-11 w-11 rounded-2xl shadow-lg" />
          <span className="flex flex-col leading-none">
            <span className="text-2xl font-extrabold tracking-tight">TAX&nbsp;iQ</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">Smart Tax Solutions</span>
          </span>
        </div>
        <div className="relative space-y-6">
          <h1 className="max-w-md text-3xl font-bold leading-tight">{tt('Azərbaycan biznesi üçün ağıllı ERP platforması', 'The smart ERP platform for Azerbaijani business')}</h1>
          <p className="max-w-sm text-white/80">{t('tagline')}</p>
          <ul className="space-y-3 text-sm text-white/90">
            {[
              [ShieldCheck, tt('Mühasibat, HR və vergi — bir yerdə', 'Accounting, HR and tax — in one place')],
              [FileSpreadsheet, tt('Rəsmi DSMF hesabatları avtomatik', 'Official DSMF reports, automated')],
              [BarChart3, tt('Real vaxt maliyyə analitikası', 'Real-time financial analytics')],
            ].map(([Icon, label], i) => (
              <li key={i} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15"><Icon className="h-4 w-4" /></span>
                {label as string}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/60">© {new Date().getFullYear()} TaxIQ Consulting MMC</p>
      </div>

      {/* Form paneli */}
      <div className="flex items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center gap-2 text-center lg:hidden">
            <Logo subtitle />
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight">{t('loginTitle')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('loginSubtitle')}</p>
          </div>

          {!configured && (
            <div className="mb-4 rounded-lg bg-warning/10 p-3 text-xs text-warning-foreground">
              {tt('⚠️ Firebase konfiqurasiya edilməyib (.env.local). Giriş işləməyəcək.', '⚠️ Firebase is not configured (.env.local). Login will not work.')}
            </div>
          )}
          {lockMsg && (
            <div className="mb-4 flex items-start gap-2 rounded-lg bg-danger/10 p-3 text-xs text-danger">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {lockMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">{t('identifier')}</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="identifier" type="text" autoComplete="username" className="pl-9" placeholder={tt('admin və ya email@nümunə.az', 'admin or email@example.az')} value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t('password')}</Label>
                <button type="button" onClick={() => setResetOpen(true)} className="text-xs font-medium text-primary hover:underline">{t('forgotPassword')}</button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password" className="px-9" value={password} onChange={(e) => setPassword(e.target.value)} required />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? tt('Parolu gizlət', 'Hide password') : tt('Parolu göstər', 'Show password')}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <LogIn />} {t('login')}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">{t('bootstrapHint')}</p>
        </div>
      </div>

      <ResetDialog open={resetOpen} onOpenChange={setResetOpen} initial={identifier} t={t} />
    </div>
  );
}

function ResetDialog({ open, onOpenChange, initial, t }: { open: boolean; onOpenChange: (o: boolean) => void; initial: string; t: ReturnType<typeof useTranslations> }) {
  const tt = useTT();
  const [email, setEmail] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim()) { toast.error(t('resetEmailLabel')); return; }
    setBusy(true);
    try {
      await sendPasswordReset(email.trim());
      toast.success(t('resetSent'), email.trim());
      onOpenChange(false);
    } catch (e) { toast.error(tt('Xəta', 'Error'), e instanceof Error ? e.message : undefined); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t('resetTitle')}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('resetSubtitle')}</p>
          <div className="space-y-2">
            <Label>{t('resetEmailLabel')}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tt('email@nümunə.az', 'email@example.az')} className="pl-9" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tt('Ləğv', 'Cancel')}</Button>
          <Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Mail className="h-4 w-4" />} {t('resetSend')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
