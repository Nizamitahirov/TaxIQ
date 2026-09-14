'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, LogIn, Lock, Mail } from 'lucide-react';
import { loginWithEmail, sendPasswordReset } from '@/lib/firebase/auth';
import { checkLockout, recordFailure, clearAttempts, formatRemaining } from '@/lib/auth/lockout';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Logo } from '@/components/layout/logo';
import { toast } from '@/components/ui/toast';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const { firebaseUser, configured, loading: authLoading, mustChangePassword } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
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
      toast.error(t('notConfigured'), 'NEXT_PUBLIC_FIREBASE_* dəyişənlərini əlavə edin');
      return;
    }
    // Cihaz-səviyyəli kilid yoxlaması (01 §3.1)
    const lock = checkLockout(identifier);
    if (lock.locked) {
      const msg = `Çox sayda uğursuz cəhd. ${formatRemaining(lock.remainingMs)} sonra yenidən cəhd edin.`;
      setLockMsg(msg); toast.error('Giriş müvəqqəti bloklandı', msg);
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
        const msg = `5 uğursuz cəhd. Giriş ${formatRemaining(st.remainingMs)} müddətinə bloklandı.`;
        setLockMsg(msg); toast.error('Giriş bloklandı', msg);
      } else {
        setLockMsg('');
        toast.error(t('invalidCredentials'), st.attemptsLeft <= 2 ? `${st.attemptsLeft} cəhd qalıb` : undefined);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Logo />
          <p className="mt-1 text-sm text-muted-foreground">{t('tagline')}</p>
        </div>

        <Card className="rounded-card">
          <CardHeader>
            <CardTitle>{t('loginTitle')}</CardTitle>
            <CardDescription>{t('loginSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!configured && (
              <div className="rounded-md bg-warning/10 p-3 text-xs text-warning-foreground">
                ⚠️ Firebase konfiqurasiya edilməyib (.env.local). Giriş işləməyəcək.
              </div>
            )}
            {lockMsg && (
              <div className="flex items-start gap-2 rounded-md bg-danger/10 p-3 text-xs text-danger">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {lockMsg}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">{t('identifier')}</Label>
                <Input id="identifier" type="text" autoComplete="username" placeholder="admin və ya email@nümunə.az" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t('password')}</Label>
                  <button type="button" onClick={() => setResetOpen(true)} className="text-xs font-medium text-primary hover:underline">{t('forgotPassword')}</button>
                </div>
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <LogIn />} {t('login')}
              </Button>
            </form>
            <p className="text-center text-xs text-muted-foreground">{t('bootstrapHint')}</p>
          </CardContent>
        </Card>
      </div>

      <ResetDialog open={resetOpen} onOpenChange={setResetOpen} initial={identifier} t={t} />
    </div>
  );
}

function ResetDialog({ open, onOpenChange, initial, t }: { open: boolean; onOpenChange: (o: boolean) => void; initial: string; t: ReturnType<typeof useTranslations> }) {
  const [email, setEmail] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim()) { toast.error(t('resetEmailLabel')); return; }
    setBusy(true);
    try {
      await sendPasswordReset(email.trim());
      toast.success(t('resetSent'), email.trim());
      onOpenChange(false);
    } catch (e) { toast.error('Xəta', e instanceof Error ? e.message : undefined); }
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
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@nümunə.az" className="pl-9" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Ləğv</Button>
          <Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Mail className="h-4 w-4" />} {t('resetSend')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
