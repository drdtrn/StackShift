/**
 * Tests for the Dashboard Overview page (US-04)
 *
 * The dashboard page:
 *   - Shows EmptyState with CTA when useProjects returns an empty array
 *   - Shows metric cards (Active Alerts, Total Logs Today, Open Incidents) with
 *     real computed counts when projects exist
 *   - Shows "—" for all metric values when no projects exist
 *   - Shows "—" for metric values while queries are loading
 *   - CTA button navigates to /projects/new
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe } from 'jest-axe';
import type { Project, Alert, Incident, CursorPaginatedResponse, LogEntry } from '@/app/types';

// ---------------------------------------------------------------------------
// Navigation mock
// ---------------------------------------------------------------------------

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
}));

// ---------------------------------------------------------------------------
// Query hook mocks
// ---------------------------------------------------------------------------

const mockUseProjects = jest.fn();
const mockUseAlerts = jest.fn();
const mockUseIncidents = jest.fn();
const mockUseLogEntries = jest.fn();

jest.mock('@/app/hooks/queries/use-projects', () => ({
  useProjects: (...args: unknown[]) => mockUseProjects(...args),
}));

jest.mock('@/app/hooks/queries/use-alerts', () => ({
  useAlerts: (...args: unknown[]) => mockUseAlerts(...args),
}));

jest.mock('@/app/hooks/queries/use-incidents', () => ({
  useIncidents: (...args: unknown[]) => mockUseIncidents(...args),
}));

jest.mock('@/app/hooks/queries', () => ({
  useLogEntries: (...args: unknown[]) => mockUseLogEntries(...args),
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

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

const STUB_ALERT_ACTIVE: Alert = {
  id: 'alert-001',
  projectId: 'proj-001',
  alertRuleId: null,
  severity: 'high',
  title: 'Test Alert',
  description: 'Test',
  firedAt: '2026-01-01T00:00:00.000Z',
  acknowledgedAt: null,
  resolvedAt: null,
  incidentId: null,
};

const STUB_ALERT_RESOLVED: Alert = {
  ...STUB_ALERT_ACTIVE,
  id: 'alert-002',
  resolvedAt: '2026-01-01T01:00:00.000Z',
};

const STUB_INCIDENT_OPEN: Incident = {
  id: 'inc-001',
  projectId: 'proj-001',
  status: 'open',
  title: 'Test Incident',
  description: null,
  severity: 'high',
  startedAt: '2026-01-01T00:00:00.000Z',
  acknowledgedAt: null,
  resolvedAt: null,
  closedAt: null,
  assigneeId: null,
  alertIds: [],
  aiAnalysisId: null,
};

const STUB_INCIDENT_RESOLVED: Incident = {
  ...STUB_INCIDENT_OPEN,
  id: 'inc-002',
  status: 'resolved',
  resolvedAt: '2026-01-01T01:00:00.000Z',
};

const STUB_INCIDENT_ACKNOWLEDGED: Incident = {
  ...STUB_INCIDENT_OPEN,
  id: 'inc-003',
  status: 'acknowledged',
  acknowledgedAt: '2026-01-01T00:05:00.000Z',
};

const STUB_LOG: LogEntry = {
  id: 'log-001',
  projectId: 'proj-001',
  logSourceId: 'source-001',
  level: 'info',
  message: 'Test log',
  timestamp: '2026-01-01T00:00:00.000Z',
  traceId: null,
  spanId: null,
  serviceName: null,
  hostName: null,
  metadata: {},
};

const SOME_LOGS: CursorPaginatedResponse<LogEntry> = {
  data: [STUB_LOG, { ...STUB_LOG, id: 'log-002' }],
  nextCursor: null,
  hasMore: false,
};

// ---------------------------------------------------------------------------
// Helper: set up hook return values
// ---------------------------------------------------------------------------

function setupMocks({
  projects = [STUB_PROJECT],
  projectsLoading = false,
  alerts = [STUB_ALERT_ACTIVE, STUB_ALERT_RESOLVED],
  alertsLoading = false,
  incidents = [STUB_INCIDENT_OPEN, STUB_INCIDENT_RESOLVED, STUB_INCIDENT_ACKNOWLEDGED],
  incidentsLoading = false,
  logData = SOME_LOGS,
  logsLoading = false,
}: {
  projects?: Project[];
  projectsLoading?: boolean;
  alerts?: Alert[];
  alertsLoading?: boolean;
  incidents?: Incident[];
  incidentsLoading?: boolean;
  logData?: CursorPaginatedResponse<LogEntry> | undefined;
  logsLoading?: boolean;
} = {}) {
  mockUseProjects.mockReturnValue({
    data: projectsLoading ? undefined : projects,
    isLoading: projectsLoading,
  });
  mockUseAlerts.mockReturnValue({
    data: alertsLoading ? undefined : alerts,
    isLoading: alertsLoading,
  });
  mockUseIncidents.mockReturnValue({
    data: incidentsLoading ? undefined : incidents,
    isLoading: incidentsLoading,
  });
  mockUseLogEntries.mockReturnValue({
    data: logsLoading ? undefined : logData,
    isLoading: logsLoading,
  });
}

// ---------------------------------------------------------------------------
// Import page (after mocks are registered)
// ---------------------------------------------------------------------------

import DashboardPage from '@/app/(dashboard)/page';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DashboardPage — empty state (no projects)', () => {
  it('shows the EmptyState component when project list is empty', () => {
    setupMocks({ projects: [] });
    render(<DashboardPage />);
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
  });

  it('shows the correct EmptyState description', () => {
    setupMocks({ projects: [] });
    render(<DashboardPage />);
    expect(
      screen.getByText(/Create your first project to start ingesting logs/i),
    ).toBeInTheDocument();
  });

  it('renders a "Create Project" CTA button', () => {
    setupMocks({ projects: [] });
    render(<DashboardPage />);
    expect(screen.getByRole('button', { name: /create project/i })).toBeInTheDocument();
  });

  it('navigates to /projects/new when CTA is clicked', () => {
    setupMocks({ projects: [] });
    render(<DashboardPage />);
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    expect(mockPush).toHaveBeenCalledWith('/projects/new');
  });

  it('shows "—" for Active Alerts when no projects exist', () => {
    setupMocks({ projects: [] });
    render(<DashboardPage />);
    // The metric card label + value are siblings in the same card
    const alertLabel = screen.getByText('Active Alerts');
    const card = alertLabel.closest('[class]')?.parentElement;
    expect(card?.textContent).toContain('—');
  });

  it('shows "—" for Open Incidents when no projects exist', () => {
    setupMocks({ projects: [] });
    render(<DashboardPage />);
    const incidentsLabel = screen.getByText('Open Incidents');
    const card = incidentsLabel.closest('[class]')?.parentElement;
    expect(card?.textContent).toContain('—');
  });

  it('shows "—" for Total Logs Today when no projects exist', () => {
    setupMocks({ projects: [] });
    render(<DashboardPage />);
    const logsLabel = screen.getByText('Total Logs Today');
    const card = logsLabel.closest('[class]')?.parentElement;
    expect(card?.textContent).toContain('—');
  });
});

describe('DashboardPage — populated state (projects exist)', () => {
  it('does NOT show the EmptyState when projects exist', () => {
    setupMocks();
    render(<DashboardPage />);
    expect(screen.queryByText('No projects yet')).not.toBeInTheDocument();
  });

  it('shows correct active alert count (excludes resolved)', () => {
    // 2 alerts: 1 active (resolvedAt null), 1 resolved
    setupMocks({
      alerts: [STUB_ALERT_ACTIVE, STUB_ALERT_RESOLVED],
    });
    render(<DashboardPage />);
    expect(screen.getByText('Active Alerts').closest('[class]')?.parentElement?.textContent)
      .toContain('1');
  });

  it('shows correct open incident count (open + acknowledged, not resolved/closed)', () => {
    // 3 incidents: 1 open, 1 resolved, 1 acknowledged → 2 open
    setupMocks({
      incidents: [STUB_INCIDENT_OPEN, STUB_INCIDENT_RESOLVED, STUB_INCIDENT_ACKNOWLEDGED],
    });
    render(<DashboardPage />);
    expect(screen.getByText('Open Incidents').closest('[class]')?.parentElement?.textContent)
      .toContain('2');
  });

  it('shows total log count', () => {
    // 2 logs in SOME_LOGS
    setupMocks({ logData: SOME_LOGS });
    render(<DashboardPage />);
    expect(screen.getByText('Total Logs Today').closest('[class]')?.parentElement?.textContent)
      .toContain('2');
  });
});

describe('DashboardPage — loading state', () => {
  it('shows "—" for all metrics while queries are loading', () => {
    setupMocks({ projectsLoading: true, alertsLoading: true, incidentsLoading: true, logsLoading: true });
    render(<DashboardPage />);
    // All three metric cards show em-dash when data is undefined
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it('shows "—" for Total Logs Today when logs are loading (even if projects exist)', () => {
    setupMocks({ logData: undefined, logsLoading: true });
    render(<DashboardPage />);
    const logsLabel = screen.getByText('Total Logs Today');
    const card = logsLabel.closest('[class]')?.parentElement;
    expect(card?.textContent).toContain('—');
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
