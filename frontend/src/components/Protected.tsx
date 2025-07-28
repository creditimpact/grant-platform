'use client';
import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function Protected({ children }: { children: ReactNode }) {
  const { user, check } = useAuth();
  const router = useRouter();

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    if (user === null) {
      router.replace('/login');
    }
  }, [user, router]);

  if (!user) return null;
  return <>{children}</>;
}
