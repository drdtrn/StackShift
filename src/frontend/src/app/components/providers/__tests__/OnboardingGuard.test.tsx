/**
 * Tests for the OnboardingGuard component
 *
 * OnboardingGuard:
 *   - Renders children when the user has an organisationId set
 *   - Redirects to /onboarding when the user has organizationId === null
 *   - Does nothing while the session is loading (children still render)
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { OnboardingGuard } from '@/app/components/providers/OnboardingGuard';
import type { User } from '@/app/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/app/hooks/useSession', () => ({
  useSession: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useSession } = require('@/app/hooks/useSession') as {
  useSession: jest.Mock;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_WITH_ORG: User = {
  id: 'u1',
  email: 'alice@acme.com',
  displayName: 'Alice',
  avatarUrl: null,
  role: 'owner',
  organizationId: 'org-1',
  createdAt: '2025-01-01T00:00:00.000Z',
  lastLoginAt: null,
};

const USER_WITHOUT_ORG: User = {
  ...USER_WITH_ORG,
  organizationId: null,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockPush.mockReset();
});

describe('OnboardingGuard', () => {
  describe('when session is loading', () => {
    it('renders children while loading (AuthGuard overlay handles the UX)', () => {
      useSession.mockReturnValue({ user: null, isLoading: true, isAuthenticated: false, error: null });

      render(
        <OnboardingGuard>
          <div data-testid="child">Dashboard</div>
        </OnboardingGuard>,
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('when user has an organisation', () => {
    it('renders children normally', () => {
      useSession.mockReturnValue({ user: USER_WITH_ORG, isLoading: false, isAuthenticated: true, error: null });

      render(
        <OnboardingGuard>
          <div data-testid="child">Dashboard</div>
        </OnboardingGuard>,
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('when user has no organisation', () => {
    it('redirects to /onboarding', () => {
      useSession.mockReturnValue({ user: USER_WITHOUT_ORG, isLoading: false, isAuthenticated: true, error: null });

      render(
        <OnboardingGuard>
          <div data-testid="child">Dashboard</div>
        </OnboardingGuard>,
      );

      expect(mockPush).toHaveBeenCalledWith('/onboarding');
    });

    it('renders null (no content flash) while redirect is in progress', () => {
      useSession.mockReturnValue({ user: USER_WITHOUT_ORG, isLoading: false, isAuthenticated: true, error: null });

      const { container } = render(
        <OnboardingGuard>
          <div data-testid="child">Dashboard</div>
        </OnboardingGuard>,
      );

      expect(container).toBeEmptyDOMElement();
    });
  });
});
