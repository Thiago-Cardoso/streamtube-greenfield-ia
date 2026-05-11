'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (isInitialized && !user) {
      router.push('/auth/login');
    }
  }, [isInitialized, user, router]);

  if (!isInitialized || !user) return null;

  return <>{children}</>;
}
