import { create } from 'zustand';
import type { User } from '@/types/auth';

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isInitialized: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setAccessToken: (token: string) => void;
}

export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  accessToken: null,
  isInitialized: false,
  setAuth: (user, token) => set({ user, accessToken: token, isInitialized: true }),
  clearAuth: () => set({ user: null, accessToken: null, isInitialized: true }),
  setAccessToken: (token) => set({ accessToken: token }),
}));

export const getAuthState = useAuthStore.getState;
