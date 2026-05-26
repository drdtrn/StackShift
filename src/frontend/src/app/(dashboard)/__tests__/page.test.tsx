import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { Organization, Project } from '@/app/types';
import type { DashboardStatsFromSchema } from '@/app/lib/api-schemas';

const mockUseProjects = jest.fn();
const mockUseDashboardStats = jest.fn();
const mockUseCurrentOrganization = jest.fn();
const mockUseSubscription = jest.fn();

jest.mock('@/app/hooks/queries/use-projects', () => ({
  useProjects: () => mockUseProjects(),
}));

jest.mock('@/app/hooks/queries/use-dashboard-stats', () => ({
  useDashboardStats: () => mockUseDashboardStats(),
}));

jest.mock('@/app/hooks/queries/use-organization', () => ({
  useCurrentOrganization: () => mockUseCurrentOrganization(),
}));

jest.mock('@/app/hooks/queries/use-subscription', () => ({
  useSubscription: () => mockUseSubscription(),
}));

const STUB_ORGANIZATION: Organization = {
  id: 'org-001',
  name: 'Real Org',
  slug: 'real-org',
  logoUrl: null,
  plan: 'team',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const STUB_PROJECT: Project = {
  id: 'proj-001',
  organizationId: 'org-001',
  name: 'Test Project',
  slug: 'test-project',
  description: null,
  color: '#3B82F6',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  logSourceCount: 0,
  activeIncidentCount: 0,
};

const STUB_STATS: DashboardStatsFromSchema = {
  activeAlertCount: 7,
  totalLogsToday: 412,
  openIncidentCount: 3,
};

interface SetupOpts {
  projects?: Project[] | undefined;
  projectsLoading?: boolean;
  stats?: DashboardStatsFromSchema | undefined;
  statsLoading?: boolean;
}

function setupMocks({
  projects = [STUB_PROJECT],
  projectsLoading = false,
  stats = STUB_STATS,
  statsLoading = false,
}: SetupOpts = {}) {
  mockUseProjects.mockReturnValue({
    data: projectsLoading ? undefined : projects,
    isLoading: projectsLoading,
  });
  mockUseDashboardStats.mockReturnValue({
    data: statsLoading ? undefined : stats,
    isLoading: statsLoading,
  });
  mockUseCurrentOrganization.mockReturnValue({
    data: STUB_ORGANIZATION,
    isLoading: false,
  });
  mockUseSubscription.mockReturnValue({
    data: {
      plan: 'team',
      status: 'active',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      hasStripeCustomer: true,
    },
    isLoading: false,
  });
}

import DashboardPage from '@/app/(dashboard)/page';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DashboardPage — empty state (no projects)', () => {
  it('shows an informational panel when project list is empty', () => {
    setupMocks({ projects: [] });
    render(<DashboardPage />);
    expect(screen.getByText('No monitored projects')).toBeInTheDocument();
  });

  it('shows the correct no-project description without a project creation CTA', () => {
    setupMocks({ projects: [] });
    render(<DashboardPage />);
    expect(
      screen.getByText(/no projects are connected yet/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create project/i })).not.toBeInTheDocument();
  });

  it('does not render a Create Project CTA button', () => {
    setupMocks({ projects: [] });
    render(<DashboardPage />);
    expect(screen.queryByRole('button', { name: /create project/i })).not.toBeInTheDocument();
  });

  it('shows em-dashes for all 3 metrics when no projects exist', () => {
    setupMocks({ projects: [] });
    render(<DashboardPage />);
    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(3);
  });

  it('does NOT call the dashboard stats endpoint visually (em-dash overrides value)', () => {
    setupMocks({ projects: [], stats: STUB_STATS });
    render(<DashboardPage />);
    const alertCard = screen.getByText('Active Alerts').closest('[class]')?.parentElement;
    expect(alertCard?.textContent).toContain('—');
    expect(alertCard?.textContent).not.toContain('7');
  });
});

describe('DashboardPage — populated state (projects exist + stats loaded)', () => {
  it('does NOT show the EmptyState when projects exist', () => {
    setupMocks();
    render(<DashboardPage />);
    expect(screen.queryByText('No monitored projects')).not.toBeInTheDocument();
  });

  it('renders activeAlertCount from the stats hook', () => {
    setupMocks();
    render(<DashboardPage />);
    const card = screen.getByText('Active Alerts').closest('[class]')?.parentElement;
    expect(card?.textContent).toContain('7');
  });

  it('renders totalLogsToday from the stats hook', () => {
    setupMocks();
    render(<DashboardPage />);
    const card = screen.getByText('Total Logs Today').closest('[class]')?.parentElement;
    expect(card?.textContent).toContain('412');
  });

  it('renders openIncidentCount from the stats hook', () => {
    setupMocks();
    render(<DashboardPage />);
    const card = screen.getByText('Open Incidents').closest('[class]')?.parentElement;
    expect(card?.textContent).toContain('3');
  });

  it('renders the "{n} projects connected" panel', () => {
    setupMocks({ projects: [STUB_PROJECT, { ...STUB_PROJECT, id: 'proj-002' }] });
    render(<DashboardPage />);
    expect(screen.getByText(/2 projects connected/)).toBeInTheDocument();
  });

  it('uses singular "project" when there is exactly one', () => {
    setupMocks({ projects: [STUB_PROJECT] });
    render(<DashboardPage />);
    expect(screen.getByText(/1 project connected/)).toBeInTheDocument();
  });

  it('renders organization and plan summaries', () => {
    setupMocks();
    render(<DashboardPage />);
    expect(screen.getByText('Real Org')).toBeInTheDocument();
    expect(screen.getByText('real-org')).toBeInTheDocument();
    expect(screen.getByText('team')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });
});

describe('DashboardPage — loading state', () => {
  it('renders skeletons in each metric card while stats are loading (projects present)', () => {
    setupMocks({ stats: undefined, statsLoading: true });
    const { container } = render(<DashboardPage />);
    const skeletons = container.querySelectorAll('span[aria-hidden="true"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(3);
  });

  it('does NOT render value text while loading (skeletons take the slot)', () => {
    setupMocks({ stats: undefined, statsLoading: true });
    render(<DashboardPage />);
    expect(screen.queryByText('7')).not.toBeInTheDocument();
    expect(screen.queryByText('412')).not.toBeInTheDocument();
    expect(screen.queryByText('3')).not.toBeInTheDocument();
  });

  it('em-dashes win over skeletons when no projects exist', () => {
    setupMocks({ projects: [], stats: undefined, statsLoading: true });
    render(<DashboardPage />);
    const dashes = screen.getAllByText('—');
    expect(dashes).toHaveLength(3);
  });
});

describe('DashboardPage — layout', () => {
  it('renders the page heading "Overview"', () => {
    setupMocks();
    render(<DashboardPage />);
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeInTheDocument();
  });

  it('renders all three metric card labels', () => {
    setupMocks();
    render(<DashboardPage />);
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();
    expect(screen.getByText('Total Logs Today')).toBeInTheDocument();
    expect(screen.getByText('Open Incidents')).toBeInTheDocument();
  });
});

describe('DashboardPage — accessibility', () => {
  it('has no critical/serious axe violations (populated state)', async () => {
    setupMocks();
    const { container } = render(<DashboardPage />);
    const results = await axe(container);
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical).toHaveLength(0);
  });

  it('has no critical/serious axe violations (empty state)', async () => {
    setupMocks({ projects: [] });
    const { container } = render(<DashboardPage />);
    const results = await axe(container);
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical).toHaveLength(0);
  });
});
