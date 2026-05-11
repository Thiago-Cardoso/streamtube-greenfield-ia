'use client';

import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';

export function AuthNav() {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  return (
    <nav className="flex items-center gap-4 border-b px-4 py-3">
      <Link href="/" className="font-semibold">
        StreamTube
      </Link>
      <Link href="/upload" className="text-sm text-blue-600 hover:underline">
        Upload
      </Link>
    </nav>
  );
}
