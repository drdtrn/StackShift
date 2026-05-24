import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from '@/app/types';

const mockReplace = jest.fn();
const mockInvalidateQueries = jest.fn();
const mockInvalidateBearerCache = jest.fn();

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
});

describe('WaitingPage', () => {
  it("renders the waiting user's email", () => {
    setUser(baseUser);
    render(<WaitingPage />);
    expect(screen.getByText(/waiting to be assigned/i)).toBeInTheDocument();
    expect(screen.getByText('viewer@example.com')).toBeInTheDocument();
  });

  it('polls every 30 seconds', () => {
    jest.useFakeTimers();
    try {
      setUser(baseUser);
      render(<WaitingPage />);

      expect(mockInvalidateQueries).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(30_000);
      });
      expect(mockInvalidateBearerCache).toHaveBeenCalledTimes(1);
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['auth', 'me'] });

      act(() => {
        jest.advanceTimersByTime(30_000);
      });
      expect(mockInvalidateQueries).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('"Check now" triggers an immediate refetch', async () => {
    setUser(baseUser);
    render(<WaitingPage />);

    await userEvent.click(screen.getByRole('button', { name: /check now/i }));

    expect(mockInvalidateBearerCache).toHaveBeenCalledTimes(1);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['auth', 'me'] });
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
