import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export async function POST(request: Request) {
  const authHeader = request.headers.get('Authorization');

  if (authHeader) {
    await fetch(`${BACKEND_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: authHeader },
    }).catch(() => {
      // best-effort: clear the cookie regardless of backend response
    });
  }

  const cookieStore = await cookies();
  cookieStore.delete('refresh_token');

  return new NextResponse(null, { status: 204 });
}
