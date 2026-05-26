import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Project } from '@/app/types';

// ---------------------------------------------------------------------------
// Mocks — declared before imports so jest.mock hoisting works
// ---------------------------------------------------------------------------

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockAddToast = jest.fn();

jest.mock('@/app/hooks/useToastStore', () => ({
  useToastStore: jest.fn((selector: (s: { addToast: typeof mockAddToast }) => unknown) =>
    selector({ addToast: mockAddToast }),
  ),
}));

const mockHandleApiError = jest.fn();

jest.mock('@/app/hooks/useApiError', () => ({
  useApiError: () => mockHandleApiError,
}));

const mockPost = jest.fn();

jest.mock('@/app/lib/api-client', () => ({
  apiClient: { post: (...args: unknown[]) => mockPost(...args), get: jest.fn() },
  ApiSchemaError: class ApiSchemaError extends Error {},
  invalidateBearerCache: jest.fn(),
}));

// Import after mocks
import { useCreateProject } from '../../mutations/use-create-project';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_PROJECT: Project = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'My Test Project',
  slug: 'my-test-project',
  description: 'A test project',
  organizationId: 'org-1',
  color: '#3b82f6',
  logSourceCount: 0,
  activeIncidentCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function mockPostSuccess(response: Project = MOCK_PROJECT) {
  mockPost.mockResolvedValueOnce({ data: response });
}

function mockPostError(status = 500) {
  const err = Object.assign(new Error('request failed'), {
    isAxiosError: true,
    response: { status, data: { title: 'Internal Server Error', status } },
  });
  mockPost.mockRejectedValueOnce(err);
}

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    qc,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  };
}

const FORM_INPUT = {
  name: 'My Project',
  description: 'Desc',
  logSourceConfig: { type: 'Application' as const, endpoint: 'http://app.local' },
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockPush.mockReset();
  mockAddToast.mockReset();
  mockHandleApiError.mockReset();
  mockPost.mockReset();
});

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe('useCreateProject — success', () => {
  it('calls POST /api/v1/projects with the backend project payload', async () => {
    mockPostSuccess();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await act(async () => { result.current.createProject(FORM_INPUT); });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/projects',
      {
        name: FORM_INPUT.name,
        description: FORM_INPUT.description,
        color: '#3b82f6',
      },
      expect.objectContaining({ schema: expect.anything() }),
    );
  });

  it('shows a success toast with the project name', async () => {
    mockPostSuccess();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await act(async () => { result.current.createProject(FORM_INPUT); });
    await waitFor(() => expect(mockAddToast).toHaveBeenCalled());

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success', message: expect.stringContaining(MOCK_PROJECT.name) }),
    );
  });

  it('redirects to /projects/{id} on success', async () => {
    mockPostSuccess();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await act(async () => { result.current.createProject(FORM_INPUT); });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    expect(mockPush).toHaveBeenCalledWith(`/projects/${MOCK_PROJECT.id}`);
  });

  it('invalidates the projects cache after success', async () => {
    mockPostSuccess();
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await act(async () => { result.current.createProject(FORM_INPUT); });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['projects'] }),
    );
  });
});

// ---------------------------------------------------------------------------
// Error path
// ---------------------------------------------------------------------------

describe('useCreateProject — error', () => {
  it('calls useApiError handler on failure', async () => {
    mockPostError(422);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await act(async () => { result.current.createProject(FORM_INPUT); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockHandleApiError).toHaveBeenCalled();
  });

  it('does not redirect on failure', async () => {
    mockPostError(500);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await act(async () => { result.current.createProject(FORM_INPUT); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// State fields
// ---------------------------------------------------------------------------

describe('useCreateProject — state fields', () => {
  it('exposes isPending, isError, error, and createProject', () => {
    mockPost.mockReturnValue(new Promise(() => {}));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateProject(), { wrapper });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.createProject).toBe('function');
  });
});
