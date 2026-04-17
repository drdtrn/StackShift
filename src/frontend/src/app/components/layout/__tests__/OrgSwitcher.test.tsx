/**
 * Tests for the OrgSwitcher component (US-06)
 *
 * Verifies:
 *   - Renders the current org name
 *   - Lists all organisations in the dropdown
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrgSwitcher } from '../OrgSwitcher';
import { MOCK_ORGANIZATIONS } from '@/app/lib/mock-data';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@/app/hooks/useSession', () => ({
  useSession: () => ({
    user: {
      id: 'user-001',
      email: 'alice@acme.com',
      displayName: 'Alice Nguyen',
      organizationId: MOCK_ORGANIZATIONS[0].id,
      role: 'owner',
      avatarUrl: null,
      createdAt: '2026-01-01T00:00:00Z',
      lastLoginAt: null,
    },
    isLoading: false,
    isAuthenticated: true,
    error: null,
  }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrgSwitcher — trigger', () => {
  it('shows the current org name', () => {
    render(<OrgSwitcher />);
    expect(screen.getByText(MOCK_ORGANIZATIONS[0].name)).toBeInTheDocument();
  });
});

describe('OrgSwitcher — dropdown', () => {
  it('lists all organisations when opened', async () => {
    const user = userEvent.setup();
    render(<OrgSwitcher />);

    // The trigger button is hidden on desktop via CSS but present in DOM
    const trigger = screen.getByRole('button', { name: /current organisation/i });
    await user.click(trigger);

    for (const org of MOCK_ORGANIZATIONS) {
      expect(screen.getByRole('menuitem', { name: org.name })).toBeInTheDocument();
    }
  });
});
