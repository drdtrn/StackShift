'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/app/hooks/useAuthStore';
import type { User } from '@/app/types';

// ---------------------------------------------------------------------------
// useSession
//
// Fetches the current user from the /api/auth/me BFF endpoint on mount and
// hydrates the Zustand useAuthStore with the result.
//
// WHY this pattern?
//   The session JWT is in an HTTP-only cookie — client JavaScript cannot
//   read it directly. /api/auth/me decodes the cookie server-side and returns
//   the user profile as plain JSON. This hook bridges the server-side session
//   with the client-side Zustand store so components can reactively respond
//   to authentication state.
//
// Key TanStack Query settings:
//   - staleTime: Infinity — the session doesn't change during a page view;
//     avoid unnecessary /api/auth/me calls on every focus/mount.
//   - retry: 1 — retry once (e.g. if the server cold-starts); but on 401
//     don't retry at all (the user genuinely isn't logged in).
//   - queryKey: ['auth', 'me'] — a dedicated key outside the domain query
//     namespaces, so it can be invalidated precisely on login/logout.
// ---------------------------------------------------------------------------

export function useSession() {
  const { setUser, setToken, reset, isAuthenticated } = useAuthStore();

  const query = useQuery<User, Error>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) {
        // Throw so TanStack Query marks this as an error state (→ not authenticated)
        throw new Error(`${res.status}`);
      }
      return res.json() as Promise<User>;
    },
    staleTime: Infinity,
    retry: (failureCount, error) => {
      // Don't retry on 401 (unauthenticated/expired) — it will always fail.
      if (error.message === '401') return false;
      return failureCount < 1;
    },
    // Suppress automatic error toasts for 401 — unauthenticated is expected
    // on the login page. The global QueryCache error handler only fires for
    // unexpected errors.
  });

  // Hydrate Zustand store whenever the query result changes.
  useEffect(() => {
    if (query.data) {
      setUser(query.data);
      // The token itself stays in the cookie — we only expose the user object
      // to the Zustand store. apiClient reads the token via /api/auth/me
      // indirectly (the cookie is sent automatically on every request).
      setToken('cookie-session'); // sentinel — tells apiClient a session exists
    } else if (query.isError) {
      reset();
    }
  }, [query.data, query.isError, setUser, setToken, reset]);

  return {
    user: query.data ?? null,
    isLoading: query.isPending,
    isAuthenticated,
    error: query.error,
  };
}
