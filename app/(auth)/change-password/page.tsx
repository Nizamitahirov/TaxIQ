'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, KeyRound } from 'lucide-react';
import { changePassword } from '@/lib/firebase/auth';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/layout/logo';
import { toast } from '@/components/ui/toast';

/**
 * Məcburi parol dəyişikliyi ekranı — 01 §3.3.
 * mustChangePassword == true olan istifadəçi buradan başqa marşruta keçə bilməz
 * (route guard: dashboard layout bu səhifəyə yönləndirir).
 */
export default function ChangePasswordPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const { firebaseUser, loading: authLoading, refresh } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !firebaseUser) router.replace('/login');
  }, [authLoading, firebaseUser, router]);

  function validate(): string | null {
    if (next.length < 8) return t('pwMinLength');
    if (!/[A-Z]/.test(next)) return t('pwUppercase');
    if (!/[0-9]/.test(next)) return t('pwDigit');
    if (next !== confirm) return t('pwMismatch');
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }
    setLoading(true);
    try {
      await changePassword(current, next);
      await refresh();
      toast.success(t('pwChanged'));
      router.replace('/dashboard');
    } catch {
      toast.error(t('pwChangeFailed'), t('pwCurrentWrong'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-2 text-center"><Logo /></div>
        <Card className="rounded-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" /> {t('changePwTitle')}</CardTitle>
            <CardDescription>{t('changePwSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current">{t('currentPassword')}</Label>
                <Input id="current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="next">{t('newPassword')}</Label>
                <Input id="next" type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
                <p className="text-xs text-muted-foreground">{t('pwRequirements')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">{t('confirmPassword')}</Label>
                <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <KeyRound />} {t('setNewPassword')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
