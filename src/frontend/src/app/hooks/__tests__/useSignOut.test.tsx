/**
 * Tests for useSignOut hook
 *
 * useSignOut encapsulates three steps in the sign-out sequence:
 *   1. useAuthStore.logout() — clears Zustand auth state
 *   2. queryClient.clear()  — wipes TanStack Query cache
 *   3. window.location.href = '/api/auth/logout' — full browser navigation
 *
 * isLoading starts false, becomes true after signOut() is called, and stays
 * true (the page navigates away before it can be reset).
 */

import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSignOut } from '@/app/hooks/useSignOut';
import { useAuthStore } from '@/app/hooks/useAuthStore';
import type { User } from '@/app/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// window.location is read-only in jsdom — we need to re-define it so we can
// spy on href assignments.
const mockLocationAssign = jest.fn();
Object.defineProperty(window, 'location', {
  value: { href: '' },
  writable: true,
});

// ---------------------------------------------------------------------------
// Wrapper + helpers
// ---------------------------------------------------------------------------

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

const MOCK_USER: User = {
  id: '00000000-0000-0000-0001-000000000001',
  email: 'alice@acme-corp.com',
  displayName: 'Alice Nguyen',
  avatarUrl: null,
  role: 'owner',
  organizationId: '00000000-0000-0000-0000-000000000001',
  createdAt: '2025-01-15T09:00:00.000Z',
  lastLoginAt: '2026-04-03T08:00:00.000Z',
};

beforeEach(() => {
  // Reset auth store
  useAuthStore.setState({
    user: MOCK_USER,
    token: 'cookie-session',
    isAuthenticated: true,
    isLoading: false,
  });
  // Reset window.location.href
  window.location.href = '';
  mockLocationAssign.mockReset();
});

afterEach(() => {
  useAuthStore.setState({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: false,
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSignOut', () => {
  describe('initial state', () => {
    it('isLoading starts as false', () => {
      const queryClient = new QueryClient();
      const { result } = renderHook(() => useSignOut(), {
        wrapper: createWrapper(queryClient),
      });
      expect(result.current.isLoading).toBe(false);
    });

    it('exposes a signOut function', () => {
      const queryClient = new QueryClient();
      const { result } = renderHook(() => useSignOut(), {
        wrapper: createWrapper(queryClient),
      });
      expect(typeof result.current.signOut).toBe('function');
    });
  });

  describe('signOut()', () => {
    it('calls useAuthStore.logout() — clears Zustand auth state', () => {
      const queryClient = new QueryClient();
      const { result } = renderHook(() => useSignOut(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.signOut();
      });

      const store = useAuthStore.getState();
      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(store.isAuthenticated).toBe(false);
    });

    it('calls queryClient.clear() — wipes TanStack Query cache', () => {
      const queryClient = new QueryClient();
      // Pre-populate cache with a sentinel entry
      queryClient.setQueryData(['auth', 'me'], MOCK_USER);
      expect(queryClient.getQueryData(['auth', 'me'])).toEqual(MOCK_USER);

      const { result } = renderHook(() => useSignOut(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.signOut();
      });

      // Cache should be empty after signOut
      expect(queryClient.getQueryData(['auth', 'me'])).toBeUndefined();
    });

    it('sets window.location.href to /api/auth/logout', () => {
      const queryClient = new QueryClient();
      const { result } = renderHook(() => useSignOut(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.signOut();
      });

      expect(window.location.href).toBe('/api/auth/logout');
    });

    it('sets isLoading to true after calling signOut()', () => {
      const queryClient = new QueryClient();
      const { result } = renderHook(() => useSignOut(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.signOut();
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('does not call logout() or navigate again if already loading (double-click guard)', () => {
      const queryClient = new QueryClient();
      const { result } = renderHook(() => useSignOut(), {
        wrapper: createWrapper(queryClient),
      });

      act(() => {
        result.current.signOut();
        result.current.signOut(); // second call — should be a no-op
      });

      // window.location.href should still be /api/auth/logout (set only once)
      expect(window.location.href).toBe('/api/auth/logout');
    });
  });
});
