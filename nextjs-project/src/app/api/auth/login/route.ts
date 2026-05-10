import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// BACKEND_URL is set in Docker so Route Handlers reach the backend via the
// internal service name. Falls back to NEXT_PUBLIC_API_URL for local dev.
const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export async function POST(request: Request) {
  const body = await request.json();

  const backendResponse = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!backendResponse.ok) {
    const error = await backendResponse.json();
    return NextResponse.json(error, { status: backendResponse.status });
  }

  const { access_token, refresh_token } = await backendResponse.json();

  const cookieStore = await cookies();
  cookieStore.set('refresh_token', refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REFRESH_TOKEN_MAX_AGE,
    path: '/',
  });

  return NextResponse.json({ access_token });
}
