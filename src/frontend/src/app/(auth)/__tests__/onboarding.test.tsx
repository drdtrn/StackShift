/**
 * Tests for the /onboarding page
 *
 * The onboarding page:
 *   - Shows a loading spinner while the session is being fetched
 *   - Redirects to /login if the user is not authenticated
 *   - Redirects to / if the user already has an org (already onboarded)
 *   - Renders the organisation name form for org-less authenticated users
 *   - Shows inline validation errors (too short, invalid chars)
 *   - Disables the submit button until the form is valid
 *   - Calls createOrganisation() when the form is submitted
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import OnboardingPage from '@/app/(auth)/onboarding/page';
import type { User } from '@/app/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockReplace = jest.fn();
const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

const mockCreateOrganisation = jest.fn();
let mockIsPending = false;

jest.mock('@/app/hooks/useCreateOrganisation', () => ({
  useCreateOrganisation: () => ({
    createOrganisation: mockCreateOrganisation,
    isPending: mockIsPending,
    isError: false,
    error: null,
  }),
}));

jest.mock('@/app/hooks/useSession', () => ({
  useSession: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useSession } = require('@/app/hooks/useSession') as {
  useSession: jest.Mock;
};

// ---------------------------------------------------------------------------
// Test users
// ---------------------------------------------------------------------------

const USER_WITHOUT_ORG: User = {
  id: 'u1',
  email: 'alice@acme.com',
  displayName: 'Alice Nguyen',
  avatarUrl: null,
  role: 'owner',
  organizationId: null,
  createdAt: '2025-01-01T00:00:00.000Z',
  lastLoginAt: null,
};

const USER_WITH_ORG: User = {
  ...USER_WITHOUT_ORG,
  organizationId: 'org-1',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockReplace.mockReset();
  mockPush.mockReset();
  mockCreateOrganisation.mockReset();
  mockIsPending = false;
});

describe('OnboardingPage', () => {
  describe('session loading state', () => {
    it('shows a loading spinner while session is being checked', () => {
      useSession.mockReturnValue({ user: null, isLoading: true, isAuthenticated: false, error: null });
      render(<OnboardingPage />);

      // Spinner is the loading indicator
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('does not show the form while loading', () => {
      useSession.mockReturnValue({ user: null, isLoading: true, isAuthenticated: false, error: null });
      render(<OnboardingPage />);

      expect(screen.queryByRole('textbox')).toBeNull();
    });
  });

  describe('redirect logic', () => {
    it('redirects to /login when user is not authenticated', () => {
      useSession.mockReturnValue({ user: null, isLoading: false, isAuthenticated: false, error: null });
      render(<OnboardingPage />);

      expect(mockReplace).toHaveBeenCalledWith('/login');
    });

    it('redirects to / when user already has an org', () => {
      useSession.mockReturnValue({ user: USER_WITH_ORG, isLoading: false, isAuthenticated: true, error: null });
      render(<OnboardingPage />);

      expect(mockReplace).toHaveBeenCalledWith('/');
    });
  });

  describe('form rendering', () => {
    beforeEach(() => {
      useSession.mockReturnValue({ user: USER_WITHOUT_ORG, isLoading: false, isAuthenticated: true, error: null });
    });

    it('renders the organisation name input', () => {
      render(<OnboardingPage />);
      expect(screen.getByRole('textbox', { name: /organisation name/i })).toBeInTheDocument();
    });

    it('renders the submit button', () => {
      render(<OnboardingPage />);
      expect(screen.getByRole('button', { name: /create organisation/i })).toBeInTheDocument();
    });

    it('greets the user by first name', () => {
      render(<OnboardingPage />);
      expect(screen.getByText(/welcome to stacksift, alice/i)).toBeInTheDocument();
    });
  });

  describe('form validation', () => {
    beforeEach(() => {
      useSession.mockReturnValue({ user: USER_WITHOUT_ORG, isLoading: false, isAuthenticated: true, error: null });
    });

    it('submit button is disabled when form is empty', () => {
      render(<OnboardingPage />);
      const button = screen.getByRole('button', { name: /create organisation/i });
      expect(button).toBeDisabled();
    });

    it('shows a validation error for a single character name', async () => {
      render(<OnboardingPage />);
      const input = screen.getByRole('textbox', { name: /organisation name/i });

      fireEvent.change(input, { target: { value: 'A' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('alert').textContent).toMatch(/at least 2/i);
      });
    });

    it('shows a validation error for names with invalid characters', async () => {
      render(<OnboardingPage />);
      const input = screen.getByRole('textbox', { name: /organisation name/i });

      fireEvent.change(input, { target: { value: 'Bad!Org' } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('alert').textContent).toMatch(/letters, numbers/i);
      });
    });

    it('submit button is enabled once the form is valid', async () => {
      render(<OnboardingPage />);
      const input = screen.getByRole('textbox', { name: /organisation name/i });
      const button = screen.getByRole('button', { name: /create organisation/i });

      fireEvent.change(input, { target: { value: 'Acme Corp' } });

      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });
  });

  describe('accessibility', () => {
    it('has no critical/serious axe violations on the form', async () => {
      useSession.mockReturnValue({ user: USER_WITHOUT_ORG, isLoading: false, isAuthenticated: true, error: null });
      const { container } = render(<OnboardingPage />);
      const results = await axe(container);
      const critical = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(critical).toHaveLength(0);
    });
  });

  describe('form submission', () => {
    beforeEach(() => {
      useSession.mockReturnValue({ user: USER_WITHOUT_ORG, isLoading: false, isAuthenticated: true, error: null });
    });

    it('calls createOrganisation with the form data on submit', async () => {
      render(<OnboardingPage />);
      const input = screen.getByRole('textbox', { name: /organisation name/i });

      fireEvent.change(input, { target: { value: 'Acme Corp' } });

      // Wait for React Hook Form to validate and enable the button
      const button = await screen.findByRole('button', { name: /create organisation/i });
      await waitFor(() => expect(button).not.toBeDisabled());

      fireEvent.click(button);

      await waitFor(() => {
        expect(mockCreateOrganisation).toHaveBeenCalledWith({ name: 'Acme Corp' });
      });
    });
  });
});
