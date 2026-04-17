/**
 * Tests for the useSession hook
 *
 * useSession:
 *   - Calls GET /api/auth/me on mount via TanStack Query
 *   - On success: hydrates useAuthStore with user + sets token sentinel
 *   - On 401/error: calls useAuthStore.reset() and returns isAuthenticated=false
 *   - Returns { user, isLoading, isAuthenticated, error }
 */

import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSession } from '@/app/hooks/useSession';
import { useAuthStore } from '@/app/hooks/useAuthStore';
import type { User } from '@/app/types';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

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

// We mock global fetch so tests don't make real network requests
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// Wrapper factory — fresh QueryClient per test
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
      },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset Zustand auth store before each test
  useAuthStore.setState({
    user: null,
    token: null,
    isLoading: false,
    isAuthenticated: false,
  });
  mockFetch.mockReset();
});

describe('useSession', () => {
  describe('loading state', () => {
    it('returns isLoading=true initially (before fetch resolves)', () => {
      // fetch never resolves — simulates a slow network
      mockFetch.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe('authenticated state', () => {
    it('returns user and isAuthenticated=true when /api/auth/me returns 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_USER,
      } as Response);

      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.user).toEqual(MOCK_USER);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('hydrates useAuthStore.user when /api/auth/me returns a user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_USER,
      } as Response);

      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const storeUser = useAuthStore.getState().user;
      expect(storeUser).toEqual(MOCK_USER);
    });

    it('sets the token sentinel in the auth store', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => MOCK_USER,
      } as Response);

      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(useAuthStore.getState().token).toBe('cookie-session');
    });
  });

  describe('unauthenticated state', () => {
    it('returns isAuthenticated=false when /api/auth/me returns 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('calls reset() on useAuthStore when /api/auth/me returns 401', async () => {
      // Pre-populate store with a user
      useAuthStore.setState({
        user: MOCK_USER,
        token: 'old-token',
        isAuthenticated: true,
        isLoading: false,
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const store = useAuthStore.getState();
      expect(store.user).toBeNull();
      expect(store.token).toBeNull();
      expect(store.isAuthenticated).toBe(false);
    });

    it('does not retry on 401 responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      } as Response);

      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Should only call fetch once — no retries on 401
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('hook return shape', () => {
    it('always returns { user, isLoading, isAuthenticated, error }', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const { result } = renderHook(() => useSession(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current).toHaveProperty('user');
      expect(result.current).toHaveProperty('isLoading');
      expect(result.current).toHaveProperty('isAuthenticated');
      expect(result.current).toHaveProperty('error');
    });
  });
});
