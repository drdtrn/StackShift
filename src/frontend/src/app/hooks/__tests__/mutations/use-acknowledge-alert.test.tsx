import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Alert } from '@/app/types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPost = jest.fn();

jest.mock('@/app/lib/api-client', () => ({
  apiClient: { post: (...args: unknown[]) => mockPost(...args), get: jest.fn() },
  ApiSchemaError: class ApiSchemaError extends Error {},
  invalidateBearerCache: jest.fn(),
}));

const mockHandleApiError = jest.fn();

jest.mock('@/app/hooks/useApiError', () => ({
  useApiError: () => mockHandleApiError,
}));

import { useAcknowledgeAlert } from '../../mutations/use-acknowledge-alert';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALERT_ID = '00000000-0000-0000-0000-000000000001';
const PROJECT_ID = '00000000-0000-0000-0000-000000000002';

const MOCK_ALERT: Alert = {
  id: ALERT_ID,
  projectId: PROJECT_ID,
  alertRuleId: null,
  severity: 'high',
  title: 'High error rate',
  description: 'Threshold exceeded',
  firedAt: '2026-01-01T00:00:00.000Z',
  acknowledgedAt: null,
  resolvedAt: null,
  incidentId: null,
};

function createWrapper(initialAlerts: Alert[] = [MOCK_ALERT]) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  qc.setQueryData(['alerts', 'list', { projectId: PROJECT_ID }], initialAlerts);
  return {
    qc,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  };
}

beforeEach(() => {
  mockPost.mockReset();
  mockHandleApiError.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAcknowledgeAlert — success', () => {
  it('calls POST /api/v1/alerts/{id}/acknowledge', async () => {
    mockPost.mockResolvedValueOnce({});
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAcknowledgeAlert(PROJECT_ID), { wrapper });

    await act(async () => { result.current.acknowledge(ALERT_ID); });
    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(mockPost).toHaveBeenCalledWith(`/api/v1/alerts/${ALERT_ID}/acknowledge`);
  });

  it('optimistically sets acknowledgedAt on the cached alert', async () => {
    // Use a never-resolving promise so we can inspect the cache mid-flight
    mockPost.mockReturnValueOnce(new Promise(() => {}));
    const { wrapper, qc } = createWrapper();
    const { result } = renderHook(() => useAcknowledgeAlert(PROJECT_ID), { wrapper });

    act(() => { result.current.acknowledge(ALERT_ID); });

    // onMutate is async (cancelQueries), so wait for setQueryData to apply
    await waitFor(() => {
      const cached = qc.getQueryData<Alert[]>(['alerts', 'list', { projectId: PROJECT_ID }]);
      expect(cached?.[0].acknowledgedAt).not.toBeNull();
    });
  });
});

describe('useAcknowledgeAlert — error', () => {
  it('calls handleApiError on failure', async () => {
    const err = Object.assign(new Error('request failed'), {
      isAxiosError: true,
      response: { status: 500 },
    });
    mockPost.mockRejectedValueOnce(err);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAcknowledgeAlert(PROJECT_ID), { wrapper });

    await act(async () => { result.current.acknowledge(ALERT_ID); });
    await waitFor(() => expect(mockHandleApiError).toHaveBeenCalled());
  });

  it('rolls back the optimistic update on failure', async () => {
    const err = Object.assign(new Error('request failed'), {
      isAxiosError: true,
      response: { status: 500 },
    });
    mockPost.mockRejectedValueOnce(err);
    const { wrapper, qc } = createWrapper();
    const { result } = renderHook(() => useAcknowledgeAlert(PROJECT_ID), { wrapper });

    await act(async () => { result.current.acknowledge(ALERT_ID); });
    await waitFor(() => expect(mockHandleApiError).toHaveBeenCalled());

    const cached = qc.getQueryData<Alert[]>(['alerts', 'list', { projectId: PROJECT_ID }]);
    expect(cached?.[0].acknowledgedAt).toBeNull();
  });
});
