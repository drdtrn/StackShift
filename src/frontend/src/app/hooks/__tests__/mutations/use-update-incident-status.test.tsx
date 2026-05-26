import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { queryKeys } from '@/app/lib/query-keys';
import type { Incident } from '@/app/types';

// ---------------------------------------------------------------------------
// Mock apiClient — declared before jest.mock() factory
// ---------------------------------------------------------------------------

const mockPatch = jest.fn();

jest.mock('@/app/lib/api-client', () => ({
  apiClient: { patch: (...args: unknown[]) => mockPatch(...args) },
}));

const mockAddToast = jest.fn();

interface ToastStoreState {
  addToast: typeof mockAddToast;
}

jest.mock('@/app/hooks/useToastStore', () => ({
  useToastStore: <T,>(selector: (s: ToastStoreState) => T): T =>
    selector({ addToast: mockAddToast }),
}));

const mockHandleError = jest.fn();

jest.mock('@/app/hooks/useApiError', () => ({
  useApiError: () => mockHandleError,
}));

import { useUpdateIncidentStatus } from '@/app/hooks/mutations/use-update-incident-status';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const INCIDENT: Incident = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  projectId: 'proj-1',
  organizationId: '00000000-0000-0000-0000-000000000001',
  status: 'open',
  title: 'Database connection pool exhausted',
  description: null,
  severity: 'high',
  startedAt: '2026-05-19T10:00:00+00:00',
  acknowledgedAt: null,
  resolvedAt: null,
  closedAt: null,
  assigneeId: null,
  aiAnalysisId: null,
};

function makeAxiosError(status: number): AxiosError {
  const err: Partial<AxiosError> = {
    isAxiosError: true,
    name: 'AxiosError',
    message: `Request failed with status code ${status}`,
    response: {
      status,
      data: {},
      statusText: '',
      headers: {},
      config: { headers: {} as never } as never,
    },
  };
  return err as AxiosError;
}

// ---------------------------------------------------------------------------
// Wrapper factory
// ---------------------------------------------------------------------------

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { qc, wrapper: Wrapper };
}

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useUpdateIncidentStatus', () => {
  it('starts as idle before mutation fires', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateIncidentStatus(), { wrapper });
    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  it('calls the correct PATCH endpoint with status body', async () => {
    const updated = { ...INCIDENT, status: 'acknowledged' as const, acknowledgedAt: '2026-05-19T10:05:00+00:00' };
    mockPatch.mockResolvedValue({ data: updated });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateIncidentStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ incidentId: INCIDENT.id, status: 'acknowledged' });
    });

    expect(mockPatch).toHaveBeenCalledWith(
      `/api/v1/incidents/${INCIDENT.id}/status`,
      { status: 'acknowledged' },
      expect.objectContaining({ schema: expect.anything() }),
    );
  });

  it('shows a success toast after updating status', async () => {
    const updated = { ...INCIDENT, status: 'acknowledged' as const };
    mockPatch.mockResolvedValue({ data: updated });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateIncidentStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ incidentId: INCIDENT.id, status: 'acknowledged' });
    });

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('optimistically updates the incident status in cache before the mutation resolves', async () => {
    let resolvePatchy!: (v: unknown) => void;
    mockPatch.mockReturnValue(new Promise((res) => { resolvePatchy = res; }));

    const { qc, wrapper } = createWrapper();
    qc.setQueryData(queryKeys.incidents.detail(INCIDENT.id), INCIDENT);

    const { result } = renderHook(() => useUpdateIncidentStatus(), { wrapper });

    act(() => {
      result.current.mutate({ incidentId: INCIDENT.id, status: 'acknowledged' });
    });

    // Optimistic update fires synchronously in onMutate
    await waitFor(() => {
      const cached = qc.getQueryData<Incident>(queryKeys.incidents.detail(INCIDENT.id));
      expect(cached?.status).toBe('acknowledged');
    });

    // Settle the mutation so cleanup runs
    const updated = { ...INCIDENT, status: 'acknowledged' as const };
    resolvePatchy({ data: updated });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('rolls back the cache when the mutation fails', async () => {
    mockPatch.mockRejectedValue(makeAxiosError(422));

    const { qc, wrapper } = createWrapper();
    qc.setQueryData(queryKeys.incidents.detail(INCIDENT.id), INCIDENT);

    const { result } = renderHook(() => useUpdateIncidentStatus(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ incidentId: INCIDENT.id, status: 'resolved' });
      } catch {
        // expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const cached = qc.getQueryData<Incident>(queryKeys.incidents.detail(INCIDENT.id));
    expect(cached?.status).toBe('open');
  });

  it('calls useApiError on mutation failure', async () => {
    mockPatch.mockRejectedValue(makeAxiosError(422));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateIncidentStatus(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ incidentId: INCIDENT.id, status: 'resolved' });
      } catch {
        // expected
      }
    });

    await waitFor(() => expect(mockHandleError).toHaveBeenCalled());
  });

  it('invalidates the incident detail and all incidents on settled', async () => {
    const updated = { ...INCIDENT, status: 'acknowledged' as const };
    mockPatch.mockResolvedValue({ data: updated });

    const { qc, wrapper } = createWrapper();
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateIncidentStatus(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ incidentId: INCIDENT.id, status: 'acknowledged' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.incidents.detail(INCIDENT.id) }),
    );
    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.incidents.all }),
    );
  });
});
