/**
 * Tests for the UserAvatarMenu component (US-06)
 *
 * Verifies:
 *   - Renders null when no user
 *   - Renders avatar initials from user display name
 *   - Sign out item calls signOut
 *   - Settings item calls router.push
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserAvatarMenu } from '../UserAvatarMenu';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSignOut = jest.fn();
const mockRouterPush = jest.fn();

jest.mock('@/app/hooks/useSession', () => ({
  useSession: jest.fn(),
}));

jest.mock('@/app/hooks/useSignOut', () => ({
  useSignOut: () => ({ signOut: mockSignOut, isLoading: false }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

import { useSession } from '@/app/hooks/useSession';
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;

const MOCK_USER = {
  id: 'user-001',
  email: 'alice@acme.com',
  displayName: 'Alice Nguyen',
  organizationId: 'org-001',
  role: 'owner' as const,
  avatarUrl: null,
  createdAt: '2026-01-01T00:00:00Z',
  lastLoginAt: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSession.mockReturnValue({
    user: MOCK_USER,
    isLoading: false,
    isAuthenticated: true,
    error: null,
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UserAvatarMenu — no user', () => {
  it('renders nothing when user is null', () => {
    mockUseSession.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    });
    const { container } = render(<UserAvatarMenu />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('UserAvatarMenu — avatar', () => {
  it('renders two-letter initials for full name', () => {
    render(<UserAvatarMenu />);
    expect(screen.getByRole('button', { name: /account menu/i })).toHaveTextContent('AN');
  });

  it('renders single initial for single-word display name', () => {
    mockUseSession.mockReturnValue({
      user: { ...MOCK_USER, displayName: 'Alice' },
      isLoading: false,
      isAuthenticated: true,
      error: null,
    });
    render(<UserAvatarMenu />);
    expect(screen.getByRole('button', { name: /account menu/i })).toHaveTextContent('A');
  });

  it('renders "?" for empty display name', () => {
    mockUseSession.mockReturnValue({
      user: { ...MOCK_USER, displayName: '' },
      isLoading: false,
      isAuthenticated: true,
      error: null,
    });
    render(<UserAvatarMenu />);
    expect(screen.getByRole('button', { name: /account menu/i })).toHaveTextContent('?');
  });
});

describe('UserAvatarMenu — dropdown actions', () => {
  it('calls signOut when "Sign out" is selected', async () => {
    const user = userEvent.setup();
    render(<UserAvatarMenu />);

    // Open the dropdown
    await user.click(screen.getByRole('button', { name: /account menu/i }));

    // Click sign out
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }));
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  it('navigates to /settings when "Settings" is selected', async () => {
    const user = userEvent.setup();
    render(<UserAvatarMenu />);

    await user.click(screen.getByRole('button', { name: /account menu/i }));
    await user.click(screen.getByRole('menuitem', { name: /settings/i }));
    expect(mockRouterPush).toHaveBeenCalledWith('/settings');
  });
});
