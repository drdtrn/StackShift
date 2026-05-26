import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Member, Organization, Project, User } from '@/app/types';
import { useAuthStore } from '@/app/hooks/useAuthStore';

const mockUseCurrentOrganization = jest.fn();
const mockUseProjects = jest.fn();
const mockUseSubscription = jest.fn();
const mockUseMembers = jest.fn();
const mockUpdateOrganization = jest.fn();
const mockUpdateProject = jest.fn();
const mockDeleteProject = jest.fn();

jest.mock('@/app/hooks/queries', () => ({
  useCurrentOrganization: () => mockUseCurrentOrganization(),
  useProjects: () => mockUseProjects(),
  useSubscription: () => mockUseSubscription(),
  useMembers: () => mockUseMembers(),
}));

jest.mock('@/app/hooks/mutations', () => ({
  useUpdateOrganization: () => ({
    mutate: mockUpdateOrganization,
    isPending: false,
  }),
  useUpdateProject: () => ({
    mutate: mockUpdateProject,
    isPending: false,
  }),
  useDeleteProject: () => ({
    mutate: mockDeleteProject,
    isPending: false,
    variables: null,
  }),
  useAddOrInviteMember: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  useUpdateMemberRole: () => ({
    mutate: jest.fn(),
  }),
  useRemoveMember: () => ({
    mutate: jest.fn(),
  }),
}));

const ORG: Organization = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'Real Org',
  slug: 'real-org',
  logoUrl: null,
  plan: 'indie',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const PROJECT: Project = {
  id: '00000000-0000-0000-0000-000000000101',
  organizationId: ORG.id,
  name: 'API Gateway',
  slug: 'api-gateway',
  description: 'Ingress services',
  color: '#3b82f6',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  logSourceCount: 2,
  activeIncidentCount: 1,
};

const MEMBER: Member = {
  id: '00000000-0000-0000-0000-000000000201',
  email: 'member@example.com',
  displayName: 'Member User',
  role: 'member',
  invitedByUserId: null,
  invitedByDisplayName: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: null,
};

const USER: User = {
  id: '00000000-0000-0000-0000-000000000301',
  email: 'owner@example.com',
  displayName: 'Owner User',
  avatarUrl: null,
  role: 'owner',
  organizationId: ORG.id,
  createdAt: '2026-01-01T00:00:00.000Z',
  lastLoginAt: null,
};

function setCommonQueries() {
  mockUseCurrentOrganization.mockReturnValue({
    data: ORG,
    isPending: false,
    isError: false,
  });
  mockUseProjects.mockReturnValue({
    data: [PROJECT],
    isPending: false,
    isError: false,
  });
  mockUseSubscription.mockReturnValue({
    data: {
      plan: 'indie',
      status: 'active',
      currentPeriodEnd: '2026-02-01T00:00:00.000Z',
      cancelAtPeriodEnd: false,
      hasStripeCustomer: true,
    },
    isPending: false,
    isError: false,
  });
  mockUseMembers.mockReturnValue({
    data: [MEMBER],
    isLoading: false,
    isPending: false,
    isError: false,
  });
}

import SettingsPage from '../page';
import OrganizationSettingsPage from '../organization/page';
import SettingsProjectsPage from '../projects/page';
import MembersPage from '../members/page';

beforeEach(() => {
  jest.clearAllMocks();
  setCommonQueries();
  useAuthStore.setState({ user: USER, token: 'token', isAuthenticated: true });
});

describe('settings pages', () => {
  it('renders the general organization, project, member, and billing summary', () => {
    render(<SettingsPage />);

    expect(screen.getByText('Real Org')).toBeInTheDocument();
    expect(screen.getByText('1/5')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('API Gateway')).toBeInTheDocument();
  });

  it('lets owners update organization profile details', async () => {
    render(<OrganizationSettingsPage />);

    const user = userEvent.setup();
    await user.clear(screen.getByLabelText(/organization name/i));
    await user.type(screen.getByLabelText(/organization name/i), 'Updated Org');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    expect(mockUpdateOrganization).toHaveBeenCalledWith({
      id: ORG.id,
      name: 'Updated Org',
      logoUrl: null,
    });
  });

  it('shows organization profile as read-only for non-owners', () => {
    useAuthStore.setState({ user: { ...USER, role: 'viewer' } });
    render(<OrganizationSettingsPage />);

    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/organization name/i)).toBeDisabled();
  });

  it('lets owners edit projects from settings', async () => {
    render(<SettingsProjectsPage />);

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.clear(screen.getByLabelText(/project name/i));
    await user.type(screen.getByLabelText(/project name/i), 'API Edge');
    await user.click(screen.getByRole('button', { name: /save project/i }));

    expect(mockUpdateProject).toHaveBeenCalledWith(
      {
        id: PROJECT.id,
        name: 'API Edge',
        description: PROJECT.description,
        color: PROJECT.color,
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it('confirms before deleting a project from settings', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SettingsProjectsPage />);

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));

    expect(confirmSpy).toHaveBeenCalledWith('Delete "API Gateway"? This cannot be undone.');
    expect(mockDeleteProject).toHaveBeenCalledWith(PROJECT.id);
    confirmSpy.mockRestore();
  });

  it('lets non-owners view members without management controls', () => {
    useAuthStore.setState({ user: { ...USER, role: 'viewer' } });
    render(<MembersPage />);

    expect(screen.getByText('Member User')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add member by email/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/role for member user/i)).not.toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });

  it('shows member management controls for owners', () => {
    render(<MembersPage />);

    expect(screen.getByRole('button', { name: /add member by email/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/role for member user/i)).toBeInTheDocument();
  });
});
