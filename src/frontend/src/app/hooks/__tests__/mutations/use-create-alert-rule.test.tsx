import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

const mockHandleApiError = jest.fn();

jest.mock('@/app/hooks/useApiError', () => ({
  useApiError: () => mockHandleApiError,
}));

const mockPost = jest.fn();

jest.mock('@/app/lib/api-client', () => ({
  apiClient: { post: (...args: unknown[]) => mockPost(...args), get: jest.fn() },
  ApiSchemaError: class ApiSchemaError extends Error {},
  invalidateBearerCache: jest.fn(),
}));

import { useCreateAlertRule } from '../../mutations/use-create-alert-rule';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function mockPostSuccess(rule: AlertRule = MOCK_RULE) {
  mockPost.mockResolvedValueOnce({ data: rule });
}

function mockPostError(status = 500) {
  const err = Object.assign(new Error('request failed'), {
    isAxiosError: true,
    response: { status, data: { title: 'Server Error', status } },
  });
  mockPost.mockRejectedValueOnce(err);
}

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

const VALID_INPUT = {
  name: 'High Error Rate',
  projectId: 'proj-1',
  condition: { type: 'ErrorRate' as const, threshold: 5, windowMinutes: 15 },
};

beforeEach(() => {
  mockPush.mockReset();
  mockAddToast.mockReset();
  mockHandleApiError.mockReset();
  mockPost.mockReset();
});

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe('useCreateAlertRule — success', () => {
  it('calls POST /api/v1/alert-rules with mapped domain payload', async () => {
    mockPostSuccess();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/alert-rules',
      expect.objectContaining({ condition: 'threshold', threshold: 5, windowMinutes: 15 }),
    );
  });

  it('maps ErrorRate condition to threshold domain value', async () => {
    mockPostSuccess();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    const payload = mockPost.mock.calls[0][1] as { condition: string };
    expect(payload.condition).toBe('threshold');
  });

  it('maps PatternMatch condition to pattern domain value', async () => {
    mockPostSuccess();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    const patternInput = {
      name: 'Error pattern',
      projectId: 'proj-1',
      condition: { type: 'PatternMatch' as const, pattern: 'ERROR.*db', logLevel: undefined },
    };

    await act(async () => { result.current.createAlertRule(patternInput); });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    const payload = mockPost.mock.calls[0][1] as { condition: string; pattern: string };
    expect(payload.condition).toBe('pattern');
    expect(payload.pattern).toBe('ERROR.*db');
  });

  it('shows success toast with rule name', async () => {
    mockPostSuccess();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(mockAddToast).toHaveBeenCalled());

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success', message: expect.stringContaining(MOCK_RULE.name) }),
    );
  });

  it('redirects to /alerts on success', async () => {
    mockPostSuccess();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/alerts'));
  });

  it('invalidates alertRules cache on success', async () => {
    mockPostSuccess();
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['alertRules'] }),
    );
  });
});

// ---------------------------------------------------------------------------
// Error path
// ---------------------------------------------------------------------------

describe('useCreateAlertRule — error', () => {
  it('calls useApiError handler on failure', async () => {
    mockPostError(422);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockHandleApiError).toHaveBeenCalled();
  });

  it('does not redirect on failure', async () => {
    mockPostError(500);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockPush).not.toHaveBeenCalled();
  });
});
