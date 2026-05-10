import { getAuthState } from '@/store/auth.store';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly error: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const { accessToken } = getAuthState();

  // Same-origin Next.js Route Handlers (/api/*) must not be prefixed with the
  // backend base URL; all other paths are backend calls.
  const baseUrl = path.startsWith('/api/') ? '' : (process.env.NEXT_PUBLIC_API_URL ?? '');

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Only set Content-Type when a body is present — avoids CORS preflight on GETs.
  if (options.body !== undefined && options.body !== null) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorBody: { statusCode: number; error: string; message: string };
    try {
      errorBody = await response.json();
    } catch {
      errorBody = {
        statusCode: response.status,
        error: 'UNKNOWN_ERROR',
        message: response.statusText,
      };
    }
    throw new ApiError(
      errorBody.statusCode ?? response.status,
      errorBody.error ?? 'UNKNOWN_ERROR',
      errorBody.message ?? response.statusText,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
