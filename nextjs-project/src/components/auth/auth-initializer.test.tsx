import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@/test-utils/render';
import { AuthInitializer } from './auth-initializer';
import { useAuthStore } from '@/store/auth.store';

vi.mock('jwt-decode', () => ({
  jwtDecode: () => ({ sub: 'u1', email: 'a@b.com' }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ user: null, accessToken: null });
});

describe('AuthInitializer', () => {
  it('calls /api/auth/refresh when no access token is present', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ access_token: 'tok.pay.sig' }), { status: 200 }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<AuthInitializer />);
    await vi.waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/refresh', { method: 'POST' }),
    );
  });

  it('sets auth state on successful refresh', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ access_token: 'tok.pay.sig' }), { status: 200 }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<AuthInitializer />);
    await vi.waitFor(() =>
      expect(useAuthStore.getState().accessToken).toBe('tok.pay.sig'),
    );
    expect(useAuthStore.getState().user).toEqual({ id: 'u1', email: 'a@b.com' });
  });

  it('calls clearAuth when refresh fails', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 401 })),
    );
    vi.stubGlobal('fetch', fetchMock);
    render(<AuthInitializer />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await vi.waitFor(() => expect(useAuthStore.getState().accessToken).toBeNull());
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('does not call refresh when access token is already set', async () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'a@b.com' }, accessToken: 'existing' });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<AuthInitializer />);
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
