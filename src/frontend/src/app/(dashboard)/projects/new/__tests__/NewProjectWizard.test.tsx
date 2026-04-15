/**
 * Integration tests for NewProjectWizard
 *
 * Tests the 3-step wizard end-to-end:
 *   Step 1 — Basic Info (name + description)
 *     - Renders name and description inputs
 *     - Blocks advancement when name is too short (< 3 chars)
 *     - Blocks advancement when name is too long (> 50 chars)
 *     - Advances to step 2 when step 1 is valid
 *
 *   Step 2 — Log Source (type selector + dynamic config field)
 *     - Shows the source type selector
 *     - Switching source type resets the config field
 *     - Blocks advancement when config field is empty
 *     - Advances to step 3 when step 2 is valid
 *
 *   Step 3 — Review (read-only summary)
 *     - Displays entered values from steps 1 and 2
 *     - Calls createProject with the correct payload on submit
 *     - Back button returns to step 2 preserving data
 *
 *   General
 *     - Cancel calls router.back()
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NewProjectWizard } from '@/app/(dashboard)/projects/new/_components/NewProjectWizard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockBack = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
}));

const mockCreateProject = jest.fn();
let mockIsPending = false;

jest.mock('@/app/hooks/mutations/use-create-project', () => ({
  useCreateProject: () => ({
    createProject: mockCreateProject,
    isPending: mockIsPending,
    isError: false,
    error: null,
  }),
}));

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function renderWizard() {
  return render(<NewProjectWizard />, { wrapper: Wrapper });
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

describe('NewProjectWizard — Step 1: Basic Info', () => {
  it('renders the project name input', () => {
    renderWizard();
    expect(screen.getByRole('textbox', { name: /project name/i })).toBeInTheDocument();
  });

  it('renders the description textarea', () => {
    renderWizard();
    expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument();
  });

  it('shows the step 1 heading', () => {
    renderWizard();
    expect(screen.getByText(/basic information/i)).toBeInTheDocument();
  });

  it('shows all three step labels in the indicator', () => {
    renderWizard();
    expect(screen.getByText('Basic Info')).toBeInTheDocument();
    expect(screen.getByText('Log Source')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('stays on step 1 when name is too short (< 3 chars)', async () => {
    renderWizard();
    fireEvent.change(screen.getByRole('textbox', { name: /project name/i }), {
      target: { value: 'AB' },
    });
    await advanceStep();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert').textContent).toMatch(/at least 3/i);
    });
    // Still on step 1 — description field still visible
    expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument();
  });

  it('stays on step 1 when name is too long (> 50 chars)', async () => {
    renderWizard();
    fireEvent.change(screen.getByRole('textbox', { name: /project name/i }), {
      target: { value: 'A'.repeat(51) },
    });
    await advanceStep();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument();
  });

  it('advances to step 2 when name is valid', async () => {
    renderWizard();
    fireEvent.change(screen.getByRole('textbox', { name: /project name/i }), {
      target: { value: 'API Gateway' },
    });
    await advanceStep();

    // Wait for a step-2-unique element (radio buttons only exist on step 2)
    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /application/i })).toBeInTheDocument();
    });
    // Step 1 description textarea is gone
    expect(screen.queryByRole('textbox', { name: /description/i })).not.toBeInTheDocument();
  });
});

describe('NewProjectWizard — Step 2: Log Source', () => {
  // Helper: fill step 1 and advance to step 2
  async function goToStep2() {
    renderWizard();
    fireEvent.change(screen.getByRole('textbox', { name: /project name/i }), {
      target: { value: 'API Gateway' },
    });
    await advanceStep();
    // Wait for a step-2-unique element — radio buttons only render on step 2
    await waitFor(() => expect(screen.getByRole('radio', { name: /application/i })).toBeInTheDocument());
  }

  it('shows the source type selector with all 4 options', async () => {
    await goToStep2();
    expect(screen.getByRole('radio', { name: /application/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /infrastructure/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /security/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /custom/i })).toBeInTheDocument();
  });

  it('defaults to Application type with endpoint field visible', async () => {
    await goToStep2();
    expect(screen.getByRole('radio', { name: /application/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('textbox', { name: /ingest endpoint url/i })).toBeInTheDocument();
  });

  it('switches to Infrastructure type and shows file path field', async () => {
    await goToStep2();
    fireEvent.click(screen.getByRole('radio', { name: /infrastructure/i }));
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /log file path/i })).toBeInTheDocument();
    });
    expect(screen.queryByRole('textbox', { name: /ingest endpoint url/i })).not.toBeInTheDocument();
  });

  it('blocks advancement when endpoint URL is empty (Application type)', async () => {
    await goToStep2();
    // Default is Application with empty endpoint — try to advance
    await advanceStep();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    // Still on step 2
    expect(screen.getByRole('radio', { name: /application/i })).toBeInTheDocument();
  });

  it('blocks advancement when URL is invalid', async () => {
    await goToStep2();
    fireEvent.change(screen.getByRole('textbox', { name: /ingest endpoint url/i }), {
      target: { value: 'not-a-url' },
    });
    await advanceStep();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('advances to step 3 (review) when config is valid', async () => {
    await goToStep2();
    fireEvent.change(screen.getByRole('textbox', { name: /ingest endpoint url/i }), {
      target: { value: 'https://api.example.com/logs' },
    });
    await advanceStep();

    await waitFor(() => {
      expect(screen.getByText(/review & create/i)).toBeInTheDocument();
    });
  });
});

describe('NewProjectWizard — Step 3: Review', () => {
  // Helper: fill all steps and arrive at review
  async function goToStep3() {
    renderWizard();

    // Step 1
    fireEvent.change(screen.getByRole('textbox', { name: /project name/i }), {
      target: { value: 'API Gateway' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /description/i }), {
      target: { value: 'Main API' },
    });
    await advanceStep();
    // Wait for radio buttons — unique to step 2
    await waitFor(() => expect(screen.getByRole('radio', { name: /application/i })).toBeInTheDocument());

    // Step 2
    fireEvent.change(screen.getByRole('textbox', { name: /ingest endpoint url/i }), {
      target: { value: 'https://api.example.com/logs' },
    });
    await advanceStep();
    // Wait for the review-step heading — "Review & create" is unique to step 3
    await waitFor(() => expect(screen.getByText(/review & create/i)).toBeInTheDocument());
  }

  it('shows the project name in the summary', async () => {
    await goToStep3();
    expect(screen.getByText('API Gateway')).toBeInTheDocument();
  });

  it('shows the description in the summary', async () => {
    await goToStep3();
    expect(screen.getByText('Main API')).toBeInTheDocument();
  });

  it('shows the log source config in the summary', async () => {
    await goToStep3();
    expect(screen.getByText(/application.*https:\/\/api\.example\.com\/logs/i)).toBeInTheDocument();
  });

  it('shows "Create Project" as the submit button label', async () => {
    await goToStep3();
    expect(screen.getByRole('button', { name: /create project/i })).toBeInTheDocument();
  });

  it('calls createProject with the correct data when submit is clicked', async () => {
    await goToStep3();
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'API Gateway',
          description: 'Main API',
          logSourceConfig: expect.objectContaining({
            type: 'Application',
            endpoint: 'https://api.example.com/logs',
          }),
        }),
      );
    });
  });

  it('navigates back to step 2 when Back is clicked', async () => {
    await goToStep3();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /application/i })).toBeInTheDocument();
    });
  });
});

describe('NewProjectWizard — Cancel', () => {
  it('calls router.back() when Cancel is clicked on step 1', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
