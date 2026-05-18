import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Project, PaginatedResponse, ApiResponse } from '@/app/types';

// ---------------------------------------------------------------------------
// Mock apiClient before importing the hooks
// ---------------------------------------------------------------------------

const mockGet = jest.fn();

jest.mock('@/app/lib/api-client', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
  ApiSchemaError: class ApiSchemaError extends Error {},
  invalidateBearerCache: jest.fn(),
}));

// Import hooks after mocks
import { useProjects, useProject } from '../../queries/use-projects';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_PROJECT: Project = {
  id: '00000000-0000-0000-0000-000000000001',
  organizationId: '00000000-0000-0000-0000-000000000002',
  name: 'Alpha Service',
  slug: 'alpha-service',
  description: 'Main backend service',
  color: '#3b82f6',
  logSourceCount: 2,
  activeIncidentCount: 1,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const MOCK_PAGINATED: PaginatedResponse<Project> = {
  data: [MOCK_PROJECT],
  total: 1,
  page: 1,
  pageSize: 50,
  hasNextPage: false,
  hasPreviousPage: false,
};

const MOCK_SINGLE: ApiResponse<Project> = {
  data: MOCK_PROJECT,
  success: true,
  message: null,
};

// ---------------------------------------------------------------------------
// Wrapper factory
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ---------------------------------------------------------------------------
// useProjects
// ---------------------------------------------------------------------------

describe('useProjects', () => {
  beforeEach(() => mockGet.mockReset());

  it('returns loading state initially', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('returns the projects array from the paginated response', async () => {
    mockGet.mockResolvedValue({ data: MOCK_PAGINATED });
    const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].name).toBe('Alpha Service');
  });

  it('calls GET /api/v1/projects with page and pageSize params', async () => {
    mockGet.mockResolvedValue({ data: MOCK_PAGINATED });
    const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/projects',
      expect.objectContaining({ params: { page: 1, pageSize: 50 } }),
    );
  });

  it('uses the correct query key prefix', async () => {
    mockGet.mockResolvedValue({ data: MOCK_PAGINATED });
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useProjects(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const cacheKeys = queryClient.getQueryCache().getAll().map((q) => q.queryKey);
    expect(cacheKeys.some((k) => Array.isArray(k) && k[0] === 'projects')).toBe(true);
  });

  it('enters error state on API failure', async () => {
    mockGet.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useProjects(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useProject (single)
// ---------------------------------------------------------------------------

describe('useProject', () => {
  beforeEach(() => mockGet.mockReset());

  it('returns the project extracted from ApiResponse', async () => {
    mockGet.mockResolvedValue({ data: MOCK_SINGLE });
    const { result } = renderHook(
      () => useProject(MOCK_PROJECT.id),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(MOCK_PROJECT.id);
    expect(result.current.data?.name).toBe(MOCK_PROJECT.name);
  });

  it('calls GET /api/v1/projects/{id}', async () => {
    mockGet.mockResolvedValue({ data: MOCK_SINGLE });
    const { result } = renderHook(
      () => useProject(MOCK_PROJECT.id),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith(
      `/api/v1/projects/${MOCK_PROJECT.id}`,
      expect.objectContaining({ schema: expect.anything() }),
    );
  });

  it('does not fetch when id is empty string', () => {
    const { result } = renderHook(() => useProject(''), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('enters error state on API failure', async () => {
    mockGet.mockRejectedValue(new Error('not found'));
    const { result } = renderHook(
      () => useProject(MOCK_PROJECT.id),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
