import React from 'react';
import { act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateProject } from '../../mutations/use-create-project';
import type { Project } from '@/app/types';

// ---------------------------------------------------------------------------
// Mocks
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

const MOCK_PROJECT: Project = {
  id: 'proj-123',
  name: 'My Test Project',
  slug: 'my-test-project',
  description: 'A test project',
  organizationId: 'org-1',
  logSourceCount: 0,
  activeIncidentCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// jsdom does not define fetch as an own property of global, so jest.spyOn
// won't work. Assign a jest.fn() directly — this is safe because each test
// reassigns or resets the mock before use.
// jsdom does not polyfill the Fetch API's Response constructor, so we mock
// the return value as a plain object with the subset of the Response interface
// that the mutation hook actually reads: `ok` and `json()`.
const mockFetch = jest.fn();

function mockFetchSuccess(project: Project = MOCK_PROJECT) {
  mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(project) });
}

function mockFetchError(body: object) {
  mockFetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve(body) });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockPush.mockReset();
  mockAddToast.mockReset();
  mockFetch.mockReset();
  global.fetch = mockFetch as typeof global.fetch;
});

describe('useCreateProject — success', () => {
  it('calls POST /api/projects with the form input', async () => {
    mockFetchSuccess();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await act(async () => {
      result.current.createProject({
        name: 'My Project',
        description: 'Desc',
        logSourceConfig: { type: 'application', endpoint: 'http://app.local' },
      });
    });

    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/projects',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows a success toast after creation', async () => {
    mockFetchSuccess();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await act(async () => {
      result.current.createProject({
        name: 'My Project',
        description: 'Desc',
        logSourceConfig: { type: 'application', endpoint: 'http://app.local' },
      });
    });

    await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('redirects to the new project page on success', async () => {
    mockFetchSuccess();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await act(async () => {
      result.current.createProject({
        name: 'My Project',
        description: 'Desc',
        logSourceConfig: { type: 'application', endpoint: 'http://app.local' },
      });
    });

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(mockPush).toHaveBeenCalledWith(`/projects/${MOCK_PROJECT.id}`);
  });

  it('invalidates the projects cache on success', async () => {
    mockFetchSuccess();
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await act(async () => {
      result.current.createProject({
        name: 'My Project',
        description: 'Desc',
        logSourceConfig: { type: 'application', endpoint: 'http://app.local' },
      });
    });

    await waitFor(() => expect(mockPush).toHaveBeenCalled());
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['projects'] }),
    );
  });
});

describe('useCreateProject — error: unauthenticated', () => {
  it('shows a session-expired error toast', async () => {
    mockFetchError({ error: 'unauthenticated' });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await act(async () => {
      result.current.createProject({
        name: 'My Project',
        description: 'Desc',
        logSourceConfig: { type: 'application', endpoint: 'http://app.local' },
      });
    });

    await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        message: expect.stringMatching(/session expired/i),
      }),
    );
  });
});

describe('useCreateProject — error: generic', () => {
  it('shows a generic error toast', async () => {
    mockFetchError({ error: 'server_error' });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateProject(), { wrapper });

    await act(async () => {
      result.current.createProject({
        name: 'My Project',
        description: 'Desc',
        logSourceConfig: { type: 'application', endpoint: 'http://app.local' },
      });
    });

    await waitFor(() => expect(mockAddToast).toHaveBeenCalled());
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        message: expect.stringMatching(/failed to create project/i),
      }),
    );
  });
});

describe('useCreateProject — isPending', () => {
  it('exposes isPending, isError, and error fields', () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateProject(), { wrapper });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.createProject).toBe('function');
  });
});
