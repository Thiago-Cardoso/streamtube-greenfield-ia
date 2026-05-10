import { create } from 'zustand';
import type { User } from '@/types/auth';

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  accessToken: null,
  setAuth: (user, token) => set({ user, accessToken: token }),
  clearAuth: () => set({ user: null, accessToken: null }),
  setAccessToken: (token) => set({ accessToken: token }),
}));

export const getAuthState = useAuthStore.getState;
