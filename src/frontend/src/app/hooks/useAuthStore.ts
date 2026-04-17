import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { User } from '@/app/types';

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface AuthStore {
  /** Authenticated user, or null when logged out / not yet loaded. */
  user: User | null;
  /** Raw Bearer token string returned by Keycloak. Null when not authenticated. */
  token: string | null;
  /** True while the initial session check (e.g. Keycloak silent refresh) is in-flight. */
  isLoading: boolean;

  // Derived
  /** Convenience boolean — true when both user and token are set. */
  isAuthenticated: boolean;

  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setLoading: (loading: boolean) => void;
  /** Full sign-out: clears user, token, and resets isAuthenticated. */
  logout: () => void;
  /** Alias for logout — used internally when a 401 is received. */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
//
// This is a **stub** — the Keycloak OIDC redirect flow is implemented in BE-03.
// The store shape is finalised here so that:
//   1. apiClient.ts can read `token` from getState() in its auth interceptor.
//   2. Future BE-03 work just fills in the Keycloak SDK calls.
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthStore>()(
  devtools(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,

      setUser: (user) =>
        set(
          () => ({ user, isAuthenticated: true }),
          false,
          'setUser',
        ),

      setToken: (token) =>
        set(
          () => ({ token }),
          false,
          'setToken',
        ),

      setLoading: (loading) =>
        set(
          () => ({ isLoading: loading }),
          false,
          'setLoading',
        ),

      logout: () =>
        set(
          () => ({ user: null, token: null, isAuthenticated: false, isLoading: false }),
          false,
          'logout',
        ),

      reset: () =>
        set(
          () => ({ user: null, token: null, isAuthenticated: false, isLoading: false }),
          false,
          'reset',
        ),
    }),
    { name: 'AuthStore' },
  ),
);
