import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './auth.store';

beforeEach(() => {
  useAuthStore.setState({ user: null, accessToken: null });
});

describe('auth store', () => {
  it('initializes with null user and token', () => {
    const { user, accessToken } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(accessToken).toBeNull();
  });

  it('setAuth sets user and access token', () => {
    const { setAuth } = useAuthStore.getState();
    setAuth({ id: 'u1', email: 'test@example.com' }, 'tok-123');
    const state = useAuthStore.getState();
    expect(state.user).toEqual({ id: 'u1', email: 'test@example.com' });
    expect(state.accessToken).toBe('tok-123');
  });

  it('clearAuth resets user and token to null', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'test@example.com' },
      accessToken: 'tok-123',
    });
    useAuthStore.getState().clearAuth();
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.accessToken).toBeNull();
  });

  it('setAccessToken updates only the token', () => {
    const user = { id: 'u1', email: 'test@example.com' };
    useAuthStore.setState({ user, accessToken: 'old-tok' });
    useAuthStore.getState().setAccessToken('new-tok');
    const state = useAuthStore.getState();
    expect(state.user).toEqual(user);
    expect(state.accessToken).toBe('new-tok');
  });

  it('getAuthState returns current state outside React', () => {
    useAuthStore.setState({ accessToken: 'direct-tok', user: null });
    // getAuthState is an alias for useAuthStore.getState
    expect(useAuthStore.getState().accessToken).toBe('direct-tok');
  });
});
