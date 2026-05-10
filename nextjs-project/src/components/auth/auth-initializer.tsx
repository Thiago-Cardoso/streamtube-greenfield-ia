'use client';

import { useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useAuthStore, getAuthState } from '@/store/auth.store';

interface JwtPayload {
  sub: string;
  email: string;
}

export function AuthInitializer() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  useEffect(() => {
    if (getAuthState().accessToken !== null) return;

    fetch('/api/auth/refresh', { method: 'POST' })
      .then((res) => {
        if (!res.ok) throw new Error('refresh failed');
        return res.json() as Promise<{ access_token: string }>;
      })
      .then(({ access_token }) => {
        const payload = jwtDecode<JwtPayload>(access_token);
        setAuth({ id: payload.sub, email: payload.email }, access_token);
      })
      .catch(() => {
        // Guard against race with a concurrent login: only clear if still unauthenticated.
        if (getAuthState().accessToken === null) {
          clearAuth();
        }
      });
  }, [setAuth, clearAuth]);

  return null;
}
