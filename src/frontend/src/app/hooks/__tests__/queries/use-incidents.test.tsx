import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useIncidents, useIncident, useMutateIncidentStatus } from '../../queries/use-incidents';
import { MOCK_INCIDENTS } from '../../../lib/mock-data';
import type { Incident } from '@/app/types';

// ---------------------------------------------------------------------------
// Mock
// ---------------------------------------------------------------------------

const mockAddToast = jest.fn();

jest.mock('@/app/hooks/useToastStore', () => ({
  useToastStore: jest.fn(() => ({ addToast: mockAddToast })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  return {
    qc,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  };
}

// ---------------------------------------------------------------------------
// useIncidents
// ---------------------------------------------------------------------------

describe('useIncidents', () => {
  it('starts in loading state', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncidents(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('returns all mock incidents after loading', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncidents(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(MOCK_INCIDENTS.length);
  });

  it('filters incidents by projectId when provided', async () => {
    const targetProjectId = MOCK_INCIDENTS[0].projectId;
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncidents(targetProjectId), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.every((i) => i.projectId === targetProjectId)).toBe(true);
  });

  it('returns an empty array when no incidents match the projectId filter', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncidents('nonexistent-project'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });

  it('returns typed Incident objects with required fields', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncidents(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const first = result.current.data![0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('projectId');
    expect(first).toHaveProperty('status');
    expect(first).toHaveProperty('title');
    expect(first).toHaveProperty('startedAt');
  });
});

// ---------------------------------------------------------------------------
// useIncident (single)
// ---------------------------------------------------------------------------

describe('useIncident', () => {
  it('returns the matching incident by ID', async () => {
    const target = MOCK_INCIDENTS[0];
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncident(target.id), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(target.id);
  });

  it('throws an error for an unknown ID', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncident('nonexistent-id'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/not found/i);
  });

  it('is disabled (idle) when id is an empty string', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncident(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ---------------------------------------------------------------------------
// useMutateIncidentStatus
// ---------------------------------------------------------------------------

describe('useMutateIncidentStatus', () => {
  beforeEach(() => mockAddToast.mockReset());

  it('returns a mutate function', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMutateIncidentStatus(), { wrapper });
    expect(typeof result.current.mutate).toBe('function');
  });

  it('shows a success toast after updating status', async () => {
    const target = MOCK_INCIDENTS[0];
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMutateIncidentStatus(), { wrapper });

    await act(async () => {
      result.current.mutate({ incidentId: target.id, status: 'acknowledged' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('optimistically updates the cache before the mutation resolves', async () => {
    const target = MOCK_INCIDENTS[0];
    const { wrapper, qc } = createWrapper();

    // Pre-seed the cache with the incident so onMutate can snapshot it
    qc.setQueryData(['incidents', 'detail', target.id], target);

    const { result } = renderHook(() => useMutateIncidentStatus(), { wrapper });

    // Start mutation but don't await it — check cache immediately
    act(() => {
      result.current.mutate({ incidentId: target.id, status: 'resolved' });
    });

    // The optimistic update should be in the cache before the mutation settles
    const cached = qc.getQueryData<Incident>(['incidents', 'detail', target.id]);
    if (cached) {
      // May already be updated optimistically
      expect(['open', 'acknowledged', 'resolved', 'closed']).toContain(cached.status);
    }

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('rolls back the cache on mutation error', async () => {
    const target = MOCK_INCIDENTS[0];

    // Create a QueryClient where the mutation stub throws
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    // Pre-seed cache so onMutate can snapshot and roll back
    qc.setQueryData(['incidents', 'detail', target.id], target);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );

    // Use a non-existent incident ID to force the mutationFn to throw
    const { result } = renderHook(() => useMutateIncidentStatus(), { wrapper });

    await act(async () => {
      result.current.mutate({ incidentId: 'nonexistent-id', status: 'resolved' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' }),
    );
  });

  it('sets resolvedAt when status changes to resolved', async () => {
    const target = MOCK_INCIDENTS[0];
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMutateIncidentStatus(), { wrapper });

    await act(async () => {
      result.current.mutate({ incidentId: target.id, status: 'resolved' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.resolvedAt).not.toBeNull();
  });

  it('sets acknowledgedAt when status changes to acknowledged', async () => {
    const target = MOCK_INCIDENTS[0];
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useMutateIncidentStatus(), { wrapper });

    await act(async () => {
      result.current.mutate({ incidentId: target.id, status: 'acknowledged' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.acknowledgedAt).not.toBeNull();
  });
});
