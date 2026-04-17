'use client';

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/app/hooks/useAuthStore';

// ---------------------------------------------------------------------------
// useSignOut
//
// Encapsulates the complete sign-out sequence in a single hook so that any
// component (UserMenu, a keyboard shortcut handler, etc.) can trigger logout
// with one call and without duplicating the three-step sequence.
//
// Sequence:
//   1. useAuthStore.logout()    — synchronously clears user/token/isAuthenticated
//      from the Zustand store. AuthGuard reads this store; it will see
//      isAuthenticated=false on its next render, but we navigate away before
//      that render happens, so there is no flash of the redirect overlay.
//
//   2. queryClient.clear()      — wipes every entry from the TanStack Query
//      cache. This is important because the cache holds sensitive data:
//      project lists, log entries, incidents, alert rules, and the ['auth','me']
//      session query. If we don't clear it, a subsequent user on the same device
//      (or the same user after re-login) could briefly see the previous user's
//      data while the first fetch is in flight.
//
//   3. window.location.href = '/api/auth/logout'
//      — a full browser navigation (not Next.js router.push). This is required
//      because the /api/auth/logout Route Handler terminates the session by
//      sending a Set-Cookie header with Max-Age=0 (or by redirecting to Keycloak
//      which does the same). A client-side navigation via router.push would be
//      intercepted by Next.js as a fetch() — the browser would receive the JSON
//      response body instead of following the 302 redirect, and the Set-Cookie
//      header would be silently discarded. window.location.href forces a real
//      GET request that the browser handles end-to-end, including following the
//      redirect and writing the cleared cookie.
//
// isLoading:
//   Set to true on the first call to signOut() and never set back to false —
//   the page navigates away entirely. This disables interactive elements
//   (e.g. the Sign out button) during the ~100ms between click and navigation,
//   preventing double-submits or a confused UI state.
// ---------------------------------------------------------------------------

export function useSignOut() {
  const { logout } = useAuthStore();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const signOut = useCallback(() => {
    if (isLoading) return; // Prevent double invocation

    setIsLoading(true);

    // Step 1 — clear Zustand auth state synchronously
    logout();

    // Step 2 — wipe all TanStack Query cache entries
    queryClient.clear();

    // Step 3 — full browser navigation to the logout Route Handler
    window.location.href = '/api/auth/logout';
  }, [isLoading, logout, queryClient]);

  return { signOut, isLoading };
}
