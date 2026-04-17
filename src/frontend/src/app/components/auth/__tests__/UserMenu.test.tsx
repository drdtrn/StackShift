/**
 * Tests for UserMenu component
 *
 * UserMenu:
 *   - Shows the authenticated user's avatar initials, display name, and email
 *   - Contains a Dropdown with a "Sign out" item
 *   - Calls useSignOut().signOut() when "Sign out" is selected
 *   - Returns null when no user is authenticated
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserMenu } from '@/app/components/auth/UserMenu';
import type { User } from '@/app/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSignOut = jest.fn();
const mockIsLoading = { value: false };

jest.mock('@/app/hooks/useSignOut', () => ({
  useSignOut: () => ({
    signOut: mockSignOut,
    isLoading: mockIsLoading.value,
  }),
}));

const mockUser: User = {
  id: '00000000-0000-0000-0001-000000000001',
  email: 'alice@acme-corp.com',
  displayName: 'Alice Nguyen',
  avatarUrl: null,
  role: 'owner',
  organizationId: '00000000-0000-0000-0000-000000000001',
  createdAt: '2025-01-15T09:00:00.000Z',
  lastLoginAt: '2026-04-03T08:00:00.000Z',
};

// Mock useSession so UserMenu gets a predictable user without needing a real
// QueryClient that fetches /api/auth/me
jest.mock('@/app/hooks/useSession', () => ({
  useSession: jest.fn(),
}));

// Mock Framer Motion to avoid layout animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      initial: _initial,
      animate: _animate,
      exit: _exit,
      transition: _transition,
      layout: _layout,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      initial?: unknown;
      animate?: unknown;
      exit?: unknown;
      transition?: unknown;
      layout?: unknown;
    }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useSession } = require('@/app/hooks/useSession') as {
  useSession: jest.Mock;
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

function renderUserMenu() {
  return render(<UserMenu />, { wrapper: createWrapper() });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockSignOut.mockReset();
  mockIsLoading.value = false;
  useSession.mockReturnValue({
    user: mockUser,
    isLoading: false,
    isAuthenticated: true,
    error: null,
  });
});

describe('UserMenu', () => {
  describe('when user is authenticated', () => {
    it('renders the user display name', () => {
      renderUserMenu();
      expect(screen.getByText('Alice Nguyen')).toBeInTheDocument();
    });

    it('renders the user email', () => {
      renderUserMenu();
      expect(screen.getByText('alice@acme-corp.com')).toBeInTheDocument();
    });

    it('renders avatar initials from the first letter of displayName', () => {
      renderUserMenu();
      expect(screen.getByText('A')).toBeInTheDocument();
    });

    it('renders the correct initials for a different user', () => {
      useSession.mockReturnValue({
        user: { ...mockUser, displayName: 'Bob Smith' },
        isLoading: false,
        isAuthenticated: true,
        error: null,
      });
      renderUserMenu();
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('renders the account menu trigger button with accessible label', () => {
      renderUserMenu();
      expect(
        screen.getByRole('button', { name: /account menu for Alice Nguyen/i }),
      ).toBeInTheDocument();
    });

    it('opens the dropdown and shows "Sign out" when trigger is clicked', () => {
      renderUserMenu();
      const trigger = screen.getByRole('button', { name: /account menu for Alice Nguyen/i });
      fireEvent.click(trigger);
      expect(screen.getByText('Sign out')).toBeInTheDocument();
    });

    it('calls signOut() when "Sign out" is clicked', () => {
      renderUserMenu();
      // Open the dropdown
      fireEvent.click(screen.getByRole('button', { name: /account menu for Alice Nguyen/i }));
      // Click Sign out
      fireEvent.click(screen.getByText('Sign out'));
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('when no user is authenticated', () => {
    it('renders nothing when user is null', () => {
      useSession.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,
      });
      const { container } = renderUserMenu();
      expect(container).toBeEmptyDOMElement();
    });
  });
});
