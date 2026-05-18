import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useProjects, useProject } from '../../queries/use-projects';
import { MOCK_PROJECTS } from '../../../lib/mock-data';

// ---------------------------------------------------------------------------
// Test wrapper — fresh QueryClient per test to isolate cache state
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,        // Don't retry on failure in tests
        staleTime: Infinity, // Prevent background refetches
      },
    },
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
  it('returns loading state initially', () => {
    const { result } = renderHook(() => useProjects(), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('returns all mock projects after loading', async () => {
    const { result } = renderHook(() => useProjects(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(MOCK_PROJECTS.length);
  });

  it('returns typed Project objects', async () => {
    const { result } = renderHook(() => useProjects(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const first = result.current.data![0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('name');
    expect(first).toHaveProperty('slug');
    expect(first).toHaveProperty('organizationId');
    expect(first).toHaveProperty('logSourceCount');
    expect(first).toHaveProperty('activeIncidentCount');
  });

  it('uses the correct query key prefix', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useProjects(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Cache key should start with 'projects'
    const cacheKeys = queryClient.getQueryCache().getAll().map((q) => q.queryKey);
    expect(cacheKeys.some((k) => Array.isArray(k) && k[0] === 'projects')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// useProject (single)
// ---------------------------------------------------------------------------

describe('useProject', () => {
  it('returns the matching project by ID', async () => {
    const targetId = MOCK_PROJECTS[0].id;
    const { result } = renderHook(() => useProject(targetId), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(targetId);
    expect(result.current.data?.name).toBe(MOCK_PROJECTS[0].name);
  });

  it('throws when project ID is not found', async () => {
    const { result } = renderHook(
      () => useProject('nonexistent-id'),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/not found/i);
  });

  it('does not fetch when id is empty string', () => {
    const { result } = renderHook(() => useProject(''), {
      wrapper: createWrapper(),
    });
    // enabled: Boolean('') === false — hook should not fire
    expect(result.current.fetchStatus).toBe('idle');
  });
});
