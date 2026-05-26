/**
 * Tests for the OrgSwitcher component (US-06)
 *
 * Verifies:
 *   - Renders the current org name
 *   - Lists all projects in the dropdown
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OrgSwitcher } from '../OrgSwitcher';
import type { Organization, Project } from '@/app/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockOrganization: Organization = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Real Org',
  slug: 'real-org',
  logoUrl: null,
  plan: 'team',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

const mockProjects: Project[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    organizationId: mockOrganization.id,
    name: 'API Gateway',
    slug: 'api-gateway',
    description: null,
    color: '#3b82f6',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    logSourceCount: 0,
    activeIncidentCount: 0,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    organizationId: mockOrganization.id,
    name: 'Worker Service',
    slug: 'worker-service',
    description: null,
    color: '#22c55e',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    logSourceCount: 0,
    activeIncidentCount: 0,
  },
];

jest.mock('@/app/hooks/queries/use-organization', () => ({
  useCurrentOrganization: () => ({ data: mockOrganization }),
}));

jest.mock('@/app/hooks/queries/use-projects', () => ({
  useProjects: () => ({ data: mockProjects }),
}));

jest.mock('@/app/hooks/queries/use-subscription', () => ({
  useSubscription: () => ({ data: { plan: 'team' } }),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OrgSwitcher — trigger', () => {
  it('shows the current org name', () => {
    render(<OrgSwitcher />);
    expect(screen.getByText('Real Org')).toBeInTheDocument();
    expect(screen.getByText('/ API Gateway')).toBeInTheDocument();
  });
});

describe('OrgSwitcher — dropdown', () => {
  it('lists all projects when opened', async () => {
    const user = userEvent.setup();
    render(<OrgSwitcher />);

    const trigger = screen.getByRole('button', { name: /current organization/i });
    await user.click(trigger);

    for (const project of mockProjects) {
      expect(screen.getByRole('menuitem', { name: project.name })).toBeInTheDocument();
    }
  });
});
