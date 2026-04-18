import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@pokayfu/shared-types';

interface AuthState {
  user:         User | null;
  accessToken:  string | null;
  refreshToken: string | null;
  isLoading:    boolean;
  isAuth:       boolean;

  setUser:       (user: User) => void;
  setTokens:     (access: string, refresh: string) => void;
  setLoading:    (v: boolean) => void;
  logout:        () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      isLoading:    true,
      isAuth:       false,

      setUser: (user) => set({ user, isAuth: true }),

      setTokens: (access, refresh) => set({
        accessToken:  access,
        refreshToken: refresh,
      }),

      setLoading: (v) => set({ isLoading: v }),

      logout: () => set({
        user:         null,
        accessToken:  null,
        refreshToken: null,
        isAuth:       false,
      }),
    }),
    {
      name:    'pokayfu-auth',
      partialize: (state) => ({
        accessToken:  state.accessToken,
        refreshToken: state.refreshToken,
        user:         state.user,
      }),
    }
  )
);
