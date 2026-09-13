'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, LogIn } from 'lucide-react';
import { loginWithEmail } from '@/lib/firebase/auth';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/layout/logo';
import { toast } from '@/components/ui/toast';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const { firebaseUser, configured, loading: authLoading, mustChangePassword } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && firebaseUser) {
      router.replace(mustChangePassword ? '/change-password' : '/dashboard');
    }
  }, [authLoading, firebaseUser, mustChangePassword, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      toast.error(t('notConfigured'), 'NEXT_PUBLIC_FIREBASE_* dəyişənlərini əlavə edin');
      return;
    }
    setLoading(true);
    try {
      await loginWithEmail(identifier, password);
      toast.success(t('welcome'));
      router.replace('/dashboard');
    } catch {
      toast.error(t('invalidCredentials'));
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

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="identifier">{t('identifier')}</Label>
                <Input id="identifier" type="text" autoComplete="username" placeholder="admin və ya email@nümunə.az" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t('password')}</Label>
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
    </div>
  );
}
