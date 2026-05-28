/**
 * Integration tests for NewProjectWizard (2-step wizard).
 *
 * Step 0 — Basic Info (name + description)
 *   - Renders name and description inputs
 *   - Blocks advancement when name is invalid
 *   - Advances to step 1 when valid
 *
 * Step 1 — Review (read-only summary)
 *   - Displays entered values
 *   - Calls createProject with the correct payload on submit
 *   - Back returns to step 0 preserving data
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NewProjectWizard } from '@/app/(dashboard)/projects/new/_components/NewProjectWizard';

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

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function renderWizard() {
  return render(<NewProjectWizard />, { wrapper: Wrapper });
}

async function advanceStep() {
  fireEvent.click(screen.getByRole('button', { name: /next/i }));
}

beforeEach(() => {
  jest.clearAllMocks();
  mockIsPending = false;
});

describe('NewProjectWizard — Step 0: Basic Info', () => {
  it('renders the project name input', () => {
    renderWizard();
    expect(screen.getByRole('textbox', { name: /project name/i })).toBeInTheDocument();
  });

  it('renders the description textarea', () => {
    renderWizard();
    expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument();
  });

  it('shows both step labels in the indicator', () => {
    renderWizard();
    expect(screen.getByText('Basic Info')).toBeInTheDocument();
    expect(screen.getByText('Review')).toBeInTheDocument();
  });

  it('stays on step 0 when name is too short', async () => {
    renderWizard();
    fireEvent.change(screen.getByRole('textbox', { name: /project name/i }), {
      target: { value: 'AB' },
    });
    await advanceStep();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('alert').textContent).toMatch(/at least 3/i);
    });
    expect(screen.getByRole('textbox', { name: /description/i })).toBeInTheDocument();
  });

  it('stays on step 0 when name is too long', async () => {
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

  it('advances to review when name is valid', async () => {
    renderWizard();
    fireEvent.change(screen.getByRole('textbox', { name: /project name/i }), {
      target: { value: 'API Gateway' },
    });
    await advanceStep();

    await waitFor(() => {
      expect(screen.getByText(/review & create/i)).toBeInTheDocument();
    });
  });
});

describe('NewProjectWizard — Step 1: Review', () => {
  async function goToReview() {
    renderWizard();
    fireEvent.change(screen.getByRole('textbox', { name: /project name/i }), {
      target: { value: 'API Gateway' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /description/i }), {
      target: { value: 'Main API' },
    });
    await advanceStep();
    await waitFor(() => expect(screen.getByText(/review & create/i)).toBeInTheDocument());
  }

  it('shows the project name in the summary', async () => {
    await goToReview();
    expect(screen.getByText('API Gateway')).toBeInTheDocument();
  });

  it('shows the description in the summary', async () => {
    await goToReview();
    expect(screen.getByText('Main API')).toBeInTheDocument();
  });

  it('shows "Create Project" as the submit button label', async () => {
    await goToReview();
    expect(screen.getByRole('button', { name: /create project/i })).toBeInTheDocument();
  });

  it('calls createProject with just name + description on submit', async () => {
    await goToReview();
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith({
        name: 'API Gateway',
        description: 'Main API',
      });
    });
  });

  it('navigates back to step 0 when Back is clicked', async () => {
    await goToReview();
    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /project name/i })).toBeInTheDocument();
    });
  });
});

describe('NewProjectWizard — Cancel', () => {
  it('calls router.back() when Cancel is clicked on step 0', () => {
    renderWizard();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
