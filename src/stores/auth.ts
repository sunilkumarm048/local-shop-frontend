import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  clear: () => void;
}

/**
 * Persists in localStorage. On every page load Next.js hydrates this from
 * storage, after which the api/socket clients pick up the token.
 */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => set({ user, token }),
      clear: () => set({ user: null, token: null }),
    }),
    { name: 'localshop-auth' }
  )
);
