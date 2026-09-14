'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';

export default function HomePage() {
  const router = useRouter();
  const { firebaseUser, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(firebaseUser ? '/launch' : '/login');
  }, [firebaseUser, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
