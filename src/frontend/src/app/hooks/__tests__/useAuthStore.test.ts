import { act, renderHook } from '@testing-library/react';
import { useAuthStore } from '../useAuthStore';
import type { User } from '../../types';

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

// Reset store between tests
beforeEach(() => {
  useAuthStore.setState({
    user: null,
    token: null,
    isLoading: false,
    isAuthenticated: false,
  });
});

describe('useAuthStore', () => {
  describe('initial state', () => {
    it('starts with no user', () => {
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.user).toBeNull();
    });

    it('starts with no token', () => {
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.token).toBeNull();
    });

    it('starts unauthenticated', () => {
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.isAuthenticated).toBe(false);
    });

    it('starts with isLoading false', () => {
      const { result } = renderHook(() => useAuthStore());
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('setUser', () => {
    it('sets user and marks isAuthenticated true', () => {
      const { result } = renderHook(() => useAuthStore());
      act(() => result.current.setUser(MOCK_USER));
      expect(result.current.user).toEqual(MOCK_USER);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('updates user correctly when called twice', () => {
      const { result } = renderHook(() => useAuthStore());
      const updated: User = { ...MOCK_USER, displayName: 'Alice (Updated)' };
      act(() => {
        result.current.setUser(MOCK_USER);
        result.current.setUser(updated);
      });
      expect(result.current.user?.displayName).toBe('Alice (Updated)');
    });
  });

  describe('setToken', () => {
    it('stores the token string', () => {
      const { result } = renderHook(() => useAuthStore());
      act(() => result.current.setToken('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9'));
      expect(result.current.token).toBe('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('does not change isAuthenticated on its own', () => {
      const { result } = renderHook(() => useAuthStore());
      act(() => result.current.setToken('some-token'));
      // isAuthenticated is only set true when setUser is called
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('logout', () => {
    it('clears user, token, and isAuthenticated', () => {
      const { result } = renderHook(() => useAuthStore());
      act(() => {
        result.current.setUser(MOCK_USER);
        result.current.setToken('some-token');
        result.current.logout();
      });
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe('reset', () => {
    it('behaves identically to logout', () => {
      const { result } = renderHook(() => useAuthStore());
      act(() => {
        result.current.setUser(MOCK_USER);
        result.current.setToken('some-token');
        result.current.reset();
      });
      expect(result.current.user).toBeNull();
      expect(result.current.token).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });
  });
});
