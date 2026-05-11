import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60;

export async function POST() {
  const cookieStore = await cookies();
  const refreshTokenCookie = cookieStore.get('refresh_token');

  if (!refreshTokenCookie) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  const backendResponse = await fetch(`${BACKEND_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshTokenCookie.value }),
  });

  if (!backendResponse.ok) {
    cookieStore.delete('refresh_token');
    const error = await backendResponse.json();
    return NextResponse.json(error, { status: backendResponse.status });
  }

  const { access_token, refresh_token } = await backendResponse.json();

  cookieStore.set('refresh_token', refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: '/',
  });

  return NextResponse.json({ access_token });
}
