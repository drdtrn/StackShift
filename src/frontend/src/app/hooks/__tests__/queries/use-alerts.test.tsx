import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Alert, PaginatedResponse } from '@/app/types';

// ---------------------------------------------------------------------------
// Mock apiClient before importing the hook
// ---------------------------------------------------------------------------

const mockGet = jest.fn();

jest.mock('@/app/lib/api-client', () => ({
  apiClient: { get: (...args: unknown[]) => mockGet(...args) },
  ApiSchemaError: class ApiSchemaError extends Error {},
  invalidateBearerCache: jest.fn(),
}));

import { useAlerts } from '../../queries/use-alerts';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const MOCK_ALERT: Alert = {
  id: '00000000-0000-0000-0000-000000000001',
  projectId: '00000000-0000-0000-0000-000000000002',
  alertRuleId: null,
  severity: 'high',
  title: 'High error rate',
  description: 'Error rate exceeded threshold',
  firedAt: '2026-01-01T00:00:00.000Z',
  acknowledgedAt: null,
  resolvedAt: null,
  incidentId: null,
};

const MOCK_PAGINATED: PaginatedResponse<Alert> = {
  data: [MOCK_ALERT],
  total: 1,
  page: 1,
  pageSize: 50,
  hasNextPage: false,
  hasPreviousPage: false,
};

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  }
  return Wrapper;
}

// ---------------------------------------------------------------------------
// useAlerts
// ---------------------------------------------------------------------------

describe('useAlerts', () => {
  beforeEach(() => mockGet.mockReset());

  it('returns loading state initially', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });

  it('returns Alert[] extracted from paginated envelope', async () => {
    mockGet.mockResolvedValue({ data: MOCK_PAGINATED });
    const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].title).toBe('High error rate');
  });

  it('calls GET /api/v1/alerts with page and pageSize', async () => {
    mockGet.mockResolvedValue({ data: MOCK_PAGINATED });
    const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/alerts',
      expect.objectContaining({ params: expect.objectContaining({ page: 1, pageSize: 50 }) }),
    );
  });

  it('forwards status filter as query param', async () => {
    mockGet.mockResolvedValue({ data: MOCK_PAGINATED });
    const { result } = renderHook(() => useAlerts({ status: 'fired' }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/alerts',
      expect.objectContaining({ params: expect.objectContaining({ status: 'fired' }) }),
    );
  });

  it('forwards severity filter as query param', async () => {
    mockGet.mockResolvedValue({ data: MOCK_PAGINATED });
    const { result } = renderHook(() => useAlerts({ severity: 'critical' }), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/alerts',
      expect.objectContaining({ params: expect.objectContaining({ severity: 'critical' }) }),
    );
  });

  it('enters error state on API failure', async () => {
    mockGet.mockRejectedValue(new Error('network error'));
    const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
