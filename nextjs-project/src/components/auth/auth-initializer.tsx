'use client';

import { useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '@/store/auth.store';

interface JwtPayload {
  sub: string;
  email: string;
}

export function AuthInitializer() {
  const { accessToken, setAuth, clearAuth } = useAuthStore();

  useEffect(() => {
    if (accessToken !== null) return;

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
        clearAuth();
      });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
