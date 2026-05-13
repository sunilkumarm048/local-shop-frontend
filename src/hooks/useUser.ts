'use client';

import { useEffect } from 'react';
import { useAuth } from '@/stores/auth';
import { refreshMe } from '@/lib/auth';

/**
 * Hook that returns the current user and (on first mount of the consumer tree)
 * verifies the persisted JWT against the backend. If the token is expired or
 * the user was deleted/blocked, auth is cleared.
 *
 * Use this once near the top of an authenticated layout, not in every component.
 */
export function useUser() {
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);

  useEffect(() => {
    if (token && !user) {
      // We have a token from a previous session but no user — refresh.
      refreshMe();
    }
  }, [token, user]);

  return { user, token, isAuthenticated: !!user };
}
