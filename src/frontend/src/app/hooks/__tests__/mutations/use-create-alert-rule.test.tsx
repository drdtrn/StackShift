import React from 'react';
import { act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateAlertRule } from '../../mutations/use-create-alert-rule';
import type { AlertRule } from '@/app/types';

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

const MOCK_RULE: AlertRule = {
  id: 'rule-001',
  name: 'High Error Rate',
  projectId: 'proj-1',
  condition: 'threshold',
  threshold: 5,
  windowMinutes: 15,
  logLevel: null,
  pattern: null,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockFetch = jest.fn();

function mockFetchSuccess(rule: AlertRule = MOCK_RULE) {
  mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(rule) });
}

function mockFetchError(body: object) {
  mockFetch.mockResolvedValueOnce({ ok: false, json: () => Promise.resolve(body) });
}

const VALID_INPUT = {
  name: 'High Error Rate',
  projectId: 'proj-1',
  condition: { type: 'ErrorRate' as const, threshold: 5, windowMinutes: 15 },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockPush.mockReset();
  mockAddToast.mockReset();
  mockFetch.mockReset();
  global.fetch = mockFetch as typeof global.fetch;
});

describe('useCreateAlertRule — success', () => {
  it('calls POST /api/alert-rules', async () => {
    mockFetchSuccess();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/alert-rules',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows a success toast', async () => {
    mockFetchSuccess();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(mockAddToast).toHaveBeenCalled());

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('redirects to /alerts on success', async () => {
    mockFetchSuccess();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    expect(mockPush).toHaveBeenCalledWith('/alerts');
  });

  it('invalidates the alerts cache', async () => {
    mockFetchSuccess();
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['alerts'] }),
    );
  });
});

describe('useCreateAlertRule — error: unauthenticated', () => {
  it('shows a session-expired error toast', async () => {
    mockFetchError({ error: 'unauthenticated' });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(mockAddToast).toHaveBeenCalled());

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        message: expect.stringMatching(/session expired/i),
      }),
    );
  });
});

describe('useCreateAlertRule — error: generic', () => {
  it('shows a generic error toast', async () => {
    mockFetchError({ error: 'server_error' });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(mockAddToast).toHaveBeenCalled());

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'error',
        message: expect.stringMatching(/failed to create alert rule/i),
      }),
    );
  });
});
