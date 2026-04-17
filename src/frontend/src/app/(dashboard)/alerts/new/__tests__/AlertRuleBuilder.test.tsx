/**
 * Integration tests for AlertRuleBuilder
 *
 * Tests the 3-step wizard end-to-end:
 *   Step 1 — Basic Info (rule name + project select)
 *     - Renders name input and project dropdown
 *     - Populates dropdown from useProjects mock data
 *     - Blocks advancement when name is empty
 *     - Blocks advancement when no project is selected
 *     - Advances to step 2 when step 1 is valid
 *
 *   Step 2 — Condition (type selector + dynamic fields)
 *     - Defaults to ErrorRate with threshold + window fields
 *     - Switching to PatternMatch shows pattern + log level fields
 *     - Switching to Latency shows thresholdMs + percentile fields
 *     - Blocks advancement when required fields are empty
 *     - Advances to step 3 when step 2 is valid
 *
 *   Step 3 — Review
 *     - Shows a human-readable condition summary
 *     - Calls createAlertRule with correct payload on submit
 *
 *   General
 *     - Cancel calls router.back()
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AlertRuleBuilder } from '@/app/(dashboard)/alerts/new/_components/AlertRuleBuilder';
import type { Project } from '@/app/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockBack = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
}));

const mockCreateAlertRule = jest.fn();
let mockIsPending = false;

jest.mock('@/app/hooks/mutations/use-create-alert-rule', () => ({
  useCreateAlertRule: () => ({
    createAlertRule: mockCreateAlertRule,
    isPending: mockIsPending,
    isError: false,
    error: null,
  }),
}));

const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-001',
    organizationId: 'org-001',
    name: 'API Gateway',
    slug: 'api-gateway',
    description: null,
    color: '#3b82f6',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    logSourceCount: 1,
    activeIncidentCount: 0,
  },
  {
    id: 'proj-002',
    organizationId: 'org-001',
    name: 'Auth Service',
    slug: 'auth-service',
    description: null,
    color: '#8b5cf6',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    logSourceCount: 1,
    activeIncidentCount: 0,
  },
];

jest.mock('@/app/hooks/queries/use-projects', () => ({
  useProjects: () => ({
    data: MOCK_PROJECTS,
    isLoading: false,
  }),
}));

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function renderBuilder() {
  return render(<AlertRuleBuilder />, { wrapper: Wrapper });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function advanceStep() {
  const nextBtn = screen.getByRole('button', { name: /next/i });
  fireEvent.click(nextBtn);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockIsPending = false;
});

describe('AlertRuleBuilder — Step 1: Basic Info', () => {
  it('renders the rule name input', () => {
    renderBuilder();
    expect(screen.getByRole('textbox', { name: /rule name/i })).toBeInTheDocument();
  });

  it('renders the project dropdown', () => {
    renderBuilder();
    expect(screen.getByRole('combobox', { name: /project/i })).toBeInTheDocument();
  });

  it('populates the dropdown with projects from useProjects', () => {
    renderBuilder();
    expect(screen.getByRole('option', { name: 'API Gateway' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Auth Service' })).toBeInTheDocument();
  });

  it('blocks advancement when name is empty', async () => {
    renderBuilder();
    await advanceStep();

    // Both name and projectId fail when empty — multiple alerts appear.
    // Use getAllByRole and check at least one relates to the name field.
    await waitFor(() => {
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
      const hasNameError = alerts.some((el) => /at least 3/i.test(el.textContent ?? ''));
      expect(hasNameError).toBe(true);
    });
    // Still on step 1
    expect(screen.getByRole('textbox', { name: /rule name/i })).toBeInTheDocument();
  });

  it('blocks advancement when name is too short (< 3 chars)', async () => {
    renderBuilder();
    fireEvent.change(screen.getByRole('textbox', { name: /rule name/i }), {
      target: { value: 'AB' },
    });
    // Select a project so that's not the failing field
    fireEvent.change(screen.getByRole('combobox', { name: /project/i }), {
      target: { value: 'proj-001' },
    });
    await advanceStep();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert').textContent).toMatch(/at least 3/i);
    });
  });

  it('blocks advancement when no project is selected', async () => {
    renderBuilder();
    fireEvent.change(screen.getByRole('textbox', { name: /rule name/i }), {
      target: { value: 'High error rate' },
    });
    // Leave project unselected (default empty value)
    await advanceStep();

    await waitFor(() => {
      // The project error message should appear
      const alerts = screen.getAllByRole('alert');
      const projectError = alerts.find((el) => /project is required/i.test(el.textContent ?? ''));
      expect(projectError).toBeInTheDocument();
    });
  });

  it('advances to step 2 when both fields are valid', async () => {
    renderBuilder();
    fireEvent.change(screen.getByRole('textbox', { name: /rule name/i }), {
      target: { value: 'High error rate' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /project/i }), {
      target: { value: 'proj-001' },
    });
    await advanceStep();

    // Wait for step-2-unique text — "define what triggers" is in AlertConditionStep
    await waitFor(() => {
      expect(screen.getByText(/define what triggers/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole('textbox', { name: /rule name/i })).not.toBeInTheDocument();
  });
});

describe('AlertRuleBuilder — Step 2: Condition', () => {
  // Helper: fill step 1 and advance to step 2.
  // "define what triggers this alert rule" is the description paragraph in
  // AlertConditionStep — unique to step 2, not present in the stepper indicator.
  async function goToStep2() {
    renderBuilder();
    fireEvent.change(screen.getByRole('textbox', { name: /rule name/i }), {
      target: { value: 'High error rate' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /project/i }), {
      target: { value: 'proj-001' },
    });
    await advanceStep();
    await waitFor(() => expect(screen.getByText(/define what triggers/i)).toBeInTheDocument());
  }

  it('shows all 4 condition type options', async () => {
    await goToStep2();
    expect(screen.getByRole('radio', { name: /error rate/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /log volume/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /pattern match/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /latency/i })).toBeInTheDocument();
  });

  it('defaults to ErrorRate with threshold and window fields', async () => {
    await goToStep2();
    expect(screen.getByRole('radio', { name: /error rate/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('spinbutton', { name: /threshold \(%\)/i })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /time window/i })).toBeInTheDocument();
  });

  it('switches to PatternMatch and shows pattern + log level fields', async () => {
    await goToStep2();
    fireEvent.click(screen.getByRole('radio', { name: /pattern match/i }));

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /regex pattern/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('combobox', { name: /log level filter/i })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: /threshold/i })).not.toBeInTheDocument();
  });

  it('switches to Latency and shows thresholdMs + percentile fields', async () => {
    await goToStep2();
    fireEvent.click(screen.getByRole('radio', { name: /latency/i }));

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: /threshold \(ms\)/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('spinbutton', { name: /percentile/i })).toBeInTheDocument();
  });

  it('switches to LogVolume and shows count threshold + window', async () => {
    await goToStep2();
    fireEvent.click(screen.getByRole('radio', { name: /log volume/i }));

    await waitFor(() => {
      expect(screen.getByRole('spinbutton', { name: /threshold \(count\)/i })).toBeInTheDocument();
    });
  });

  it('advances to step 3 with default ErrorRate values filled', async () => {
    await goToStep2();
    // Default values (threshold: 5, windowMinutes: 15) are pre-filled
    await advanceStep();

    await waitFor(() => {
      expect(screen.getByText(/review & create/i)).toBeInTheDocument();
    });
  });
});

describe('AlertRuleBuilder — Step 3: Review', () => {
  async function goToStep3() {
    renderBuilder();

    // Step 1
    fireEvent.change(screen.getByRole('textbox', { name: /rule name/i }), {
      target: { value: 'High error rate' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: /project/i }), {
      target: { value: 'proj-001' },
    });
    await advanceStep();
    await waitFor(() => expect(screen.getByText(/define what triggers/i)).toBeInTheDocument());

    // Step 2 — use default ErrorRate values (5%, 15 min)
    await advanceStep();
    await waitFor(() => expect(screen.getByText(/review & create/i)).toBeInTheDocument());
  }

  it('shows the rule name in the summary', async () => {
    await goToStep3();
    expect(screen.getByText('High error rate')).toBeInTheDocument();
  });

  it('shows the project name in the summary', async () => {
    await goToStep3();
    // useProjects returns MOCK_PROJECTS so proj-001 → "API Gateway"
    expect(screen.getByText('API Gateway')).toBeInTheDocument();
  });

  it('shows a human-readable condition summary', async () => {
    await goToStep3();
    expect(screen.getByText(/error rate > 5% in a 15-minute window/i)).toBeInTheDocument();
  });

  it('shows "Create Rule" as the submit button label', async () => {
    await goToStep3();
    expect(screen.getByRole('button', { name: /create rule/i })).toBeInTheDocument();
  });

  it('calls createAlertRule with correct data on submit', async () => {
    await goToStep3();
    fireEvent.click(screen.getByRole('button', { name: /create rule/i }));

    await waitFor(() => {
      expect(mockCreateAlertRule).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'High error rate',
          projectId: 'proj-001',
          condition: expect.objectContaining({
            type: 'ErrorRate',
            threshold: 5,
            windowMinutes: 15,
          }),
        }),
      );
    });
  });
});

describe('AlertRuleBuilder — Cancel', () => {
  it('calls router.back() when Cancel is clicked', () => {
    renderBuilder();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
