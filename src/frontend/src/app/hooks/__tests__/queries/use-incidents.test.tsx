import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mock apiClient — must be declared before jest.mock() factory
// ---------------------------------------------------------------------------

const mockGet = jest.fn();

jest.mock('@/app/lib/api-client', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
}));

// Import hook after mock registration
import {
  useIncidents,
  useIncident,
  useIncidentAlerts,
} from '@/app/hooks/queries/use-incidents';
import type { Incident, Alert, PaginatedResponse, ApiResponse } from '@/app/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const INCIDENT: Incident = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  projectId: 'proj-1',
  status: 'open',
  title: 'Database connection pool exhausted',
  description: 'High connection count observed',
  severity: 'high',
  startedAt: '2026-05-19T10:00:00+00:00',
  acknowledgedAt: null,
  resolvedAt: null,
  closedAt: null,
  assigneeId: null,
  alertIds: [],
  aiAnalysisId: null,
};

const INCIDENT_2: Incident = {
  ...INCIDENT,
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  projectId: 'proj-2',
  status: 'resolved',
  title: 'API latency spike',
};

function makePaginatedResponse<T>(items: T[]): PaginatedResponse<T> {
  return {
    data: items,
    total: items.length,
    page: 1,
    pageSize: 20,
    hasNextPage: false,
    hasPreviousPage: false,
  };
}

function makeApiResponse<T>(item: T): ApiResponse<T> {
  return { data: item, success: true, message: null };
}

const ALERT: Alert = {
  id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  projectId: 'proj-1',
  alertRuleId: null,
  severity: 'high',
  title: 'High CPU',
  description: 'CPU usage exceeded 90%',
  firedAt: '2026-05-19T09:55:00+00:00',
  acknowledgedAt: null,
  resolvedAt: null,
  incidentId: INCIDENT.id,
};

// ---------------------------------------------------------------------------
// Wrapper factory
// ---------------------------------------------------------------------------

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return { qc, wrapper: Wrapper };
}

beforeEach(() => jest.clearAllMocks());

// ---------------------------------------------------------------------------
// useIncidents
// ---------------------------------------------------------------------------

describe('useIncidents', () => {
  it('starts in loading state', () => {
    mockGet.mockResolvedValue({ data: makePaginatedResponse([INCIDENT]) });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncidents(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('returns incidents list on success', async () => {
    mockGet.mockResolvedValue({ data: makePaginatedResponse([INCIDENT, INCIDENT_2]) });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncidents(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(2);
  });

  it('passes status filter as query param', async () => {
    mockGet.mockResolvedValue({ data: makePaginatedResponse([INCIDENT]) });
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useIncidents({ status: 'open' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/incidents',
      expect.objectContaining({
        params: expect.objectContaining({ status: 'open' }),
      }),
    );
  });

  it('passes projectId filter as query param', async () => {
    mockGet.mockResolvedValue({ data: makePaginatedResponse([INCIDENT]) });
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useIncidents({ projectId: 'proj-1' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/incidents',
      expect.objectContaining({
        params: expect.objectContaining({ projectId: 'proj-1' }),
      }),
    );
  });

  it('returns typed Incident objects with required fields', async () => {
    mockGet.mockResolvedValue({ data: makePaginatedResponse([INCIDENT]) });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncidents(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const first = result.current.data!.data[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('status');
    expect(first).toHaveProperty('title');
    expect(first).toHaveProperty('startedAt');
  });

  it('enters error state when the API call fails', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncidents(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useIncident
// ---------------------------------------------------------------------------

describe('useIncident', () => {
  it('returns the matching incident by ID', async () => {
    mockGet.mockResolvedValue({ data: makeApiResponse(INCIDENT) });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncident(INCIDENT.id), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(INCIDENT.id);
  });

  it('is disabled (idle) when id is an empty string', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncident(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('enters error state when the API returns an error', async () => {
    mockGet.mockRejectedValue(new Error('Not found'));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncident('nonexistent'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('calls the correct endpoint', async () => {
    mockGet.mockResolvedValue({ data: makeApiResponse(INCIDENT) });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncident(INCIDENT.id), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith(
      `/api/v1/incidents/${INCIDENT.id}`,
      expect.objectContaining({ schema: expect.anything() }),
    );
  });
});

// ---------------------------------------------------------------------------
// useIncidentAlerts
// ---------------------------------------------------------------------------

describe('useIncidentAlerts', () => {
  it('returns alerts for a given incident ID', async () => {
    mockGet.mockResolvedValue({ data: makePaginatedResponse([ALERT]) });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncidentAlerts(INCIDENT.id), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].id).toBe(ALERT.id);
  });

  it('is disabled when incidentId is empty', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncidentAlerts(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('passes incidentId as query param', async () => {
    mockGet.mockResolvedValue({ data: makePaginatedResponse([ALERT]) });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useIncidentAlerts(INCIDENT.id), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/alerts',
      expect.objectContaining({
        params: expect.objectContaining({ incidentId: INCIDENT.id }),
      }),
    );
  });
});
