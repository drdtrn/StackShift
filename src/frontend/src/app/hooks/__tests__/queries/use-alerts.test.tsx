import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAlerts, useAlert, useCreateAlert } from '../../queries/use-alerts';
import { MOCK_ALERTS } from '../../../lib/mock-data';

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
// useAlerts
// ---------------------------------------------------------------------------

describe('useAlerts', () => {
  it('starts in loading state', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAlerts(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('returns all mock alerts after loading', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAlerts(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(MOCK_ALERTS.length);
  });

  it('filters alerts by projectId when provided', async () => {
    const targetProjectId = MOCK_ALERTS[0].projectId;
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAlerts(targetProjectId), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.every((a) => a.projectId === targetProjectId)).toBe(true);
  });

  it('returns an empty array when no alerts match the projectId filter', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAlerts('nonexistent-project'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });

  it('returns typed Alert objects with required fields', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAlerts(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const first = result.current.data![0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('projectId');
    expect(first).toHaveProperty('severity');
    expect(first).toHaveProperty('title');
    expect(first).toHaveProperty('firedAt');
  });
});

// ---------------------------------------------------------------------------
// useAlert (single)
// ---------------------------------------------------------------------------

describe('useAlert', () => {
  it('returns the matching alert by ID', async () => {
    const target = MOCK_ALERTS[0];
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAlert(target.id), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(target.id);
  });

  it('throws an error for an unknown ID', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAlert('nonexistent-id'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/not found/i);
  });

  it('is disabled (idle) when id is an empty string', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAlert(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ---------------------------------------------------------------------------
// useCreateAlert
// ---------------------------------------------------------------------------

describe('useCreateAlert', () => {
  beforeEach(() => mockAddToast.mockReset());

  it('returns a mutate function', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlert(), { wrapper });
    expect(typeof result.current.mutate).toBe('function');
  });

  it('shows a success toast after creating an alert', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlert(), { wrapper });

    await act(async () => {
      result.current.mutate({
        projectId: MOCK_ALERTS[0].projectId,
        title: 'Test Alert',
        description: 'A test alert',
        severity: 'high',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('returns a new alert with a generated id on success', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlert(), { wrapper });

    await act(async () => {
      result.current.mutate({
        projectId: MOCK_ALERTS[0].projectId,
        title: 'Test Alert',
        description: 'A test alert',
        severity: 'medium',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toMatch(/^alert-/);
    expect(result.current.data?.severity).toBe('medium');
  });
});
