import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from '@/app/types';

const mockReplace = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockInvalidateBearerCache = jest.fn();
const mockFetch = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn() }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

jest.mock('@/app/hooks/useAuthStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/app/lib/api-client', () => ({
  invalidateBearerCache: () => mockInvalidateBearerCache(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useAuthStore } = require('@/app/hooks/useAuthStore') as {
  useAuthStore: jest.Mock;
};

import WaitingPage from '../waiting/page';

const baseUser: User = {
  id: 'u1',
  email: 'viewer@example.com',
  displayName: 'Viewer V',
  avatarUrl: null,
  role: 'viewer',
  organizationId: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  lastLoginAt: null,
};

function setUser(user: User | null): void {
  useAuthStore.mockImplementation((selector: (s: { user: User | null }) => unknown) =>
    selector({ user }),
  );
}

beforeEach(() => {
  mockReplace.mockReset();
  mockInvalidateQueries.mockReset();
  mockInvalidateBearerCache.mockReset();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true });
  global.fetch = mockFetch;
});

afterEach(() => {
  // restore real fetch if needed
});

describe('WaitingPage', () => {
  it("renders the waiting user's email", () => {
    setUser(baseUser);
    render(<WaitingPage />);
    expect(screen.getByText(/waiting to be assigned/i)).toBeInTheDocument();
    expect(screen.getByText('viewer@example.com')).toBeInTheDocument();
  });

  it('polls every 30 seconds calling refresh before cache clear', async () => {
    jest.useFakeTimers();
    const callOrder: string[] = [];
    mockFetch.mockImplementation(async () => {
      callOrder.push('fetch');
      return { ok: true };
    });
    mockInvalidateBearerCache.mockImplementation(() => callOrder.push('invalidateBearerCache'));
    mockInvalidateQueries.mockImplementation(() => callOrder.push('invalidateQueries'));

    try {
      setUser(baseUser);
      render(<WaitingPage />);

      expect(mockInvalidateQueries).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(30_000);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
      });
      expect(mockInvalidateBearerCache).toHaveBeenCalledTimes(1);
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['auth', 'me'] });

      expect(callOrder.indexOf('fetch')).toBeLessThan(callOrder.indexOf('invalidateBearerCache'));
      expect(callOrder.indexOf('invalidateBearerCache')).toBeLessThan(callOrder.indexOf('invalidateQueries'));
    } finally {
      jest.useRealTimers();
    }
  });

  it('"Check now" triggers an immediate refetch', async () => {
    setUser(baseUser);
    render(<WaitingPage />);

    await userEvent.click(screen.getByRole('button', { name: /check now/i }));

    expect(mockFetch).toHaveBeenCalledWith('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    });
    expect(mockInvalidateBearerCache).toHaveBeenCalledTimes(1);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['auth', 'me'] });
  });

  it('"Check now" shows "Checking…" while in flight and re-enables on completion', async () => {
    let resolveFetch!: () => void;
    mockFetch.mockImplementation(
      () => new Promise<{ ok: boolean }>((resolve) => { resolveFetch = () => resolve({ ok: true }); }),
    );

    setUser(baseUser);
    render(<WaitingPage />);

    const btn = screen.getByRole('button', { name: /check now/i });
    expect(btn).not.toBeDisabled();

    await userEvent.click(btn);

    expect(screen.getByRole('button', { name: /checking…/i })).toBeDisabled();

    await act(async () => {
      resolveFetch();
    });

    expect(screen.getByRole('button', { name: /check now/i })).not.toBeDisabled();
  });

  it('transitions to / when organizationId becomes non-null', () => {
    setUser({ ...baseUser, organizationId: 'org-1' });
    render(<WaitingPage />);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('cleans up the interval on unmount', () => {
    jest.useFakeTimers();
    try {
      setUser(baseUser);
      const { unmount } = render(<WaitingPage />);
      unmount();

      act(() => {
        jest.advanceTimersByTime(60_000);
      });

      expect(mockInvalidateQueries).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
