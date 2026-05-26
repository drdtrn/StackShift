import React from 'react';
import { act, waitFor } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreateAlertRule } from '../../mutations/use-create-alert-rule';
import type { AlertRule } from '@/app/types';
import { queryKeys } from '@/app/lib/query-keys';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockAddToast = jest.fn();
const mockPost = jest.fn();
const mockHandleApiError = jest.fn();

jest.mock('@/app/lib/api-client', () => ({
  apiClient: { post: (...args: Parameters<typeof mockPost>) => mockPost(...args) },
}));

jest.mock('@/app/hooks/useToastStore', () => ({
  useToastStore: jest.fn((selector: (s: { addToast: typeof mockAddToast }) => unknown) =>
    selector({ addToast: mockAddToast }),
  ),
}));

jest.mock('@/app/hooks/useApiError', () => ({
  useApiError: () => mockHandleApiError,
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
  organizationId: '00000000-0000-0000-0000-000000000001',
  condition: 'threshold',
  threshold: 5,
  windowMinutes: 15,
  logLevel: null,
  pattern: null,
  isActive: true,
  severity: 'medium',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

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
  mockPost.mockReset();
  mockHandleApiError.mockReset();
});

describe('useCreateAlertRule — success', () => {
  it('calls POST /api/v1/alert-rules', async () => {
    mockPost.mockResolvedValue({ data: MOCK_RULE });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/alert-rules',
      expect.objectContaining({
        name: 'High Error Rate',
        projectId: 'proj-1',
        condition: 'threshold',
        threshold: 5,
        windowMinutes: 15,
      }),
      expect.objectContaining({ schema: expect.any(Object) }),
    );
  });

  it('shows a success toast', async () => {
    mockPost.mockResolvedValue({ data: MOCK_RULE });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(mockAddToast).toHaveBeenCalled());

    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'success' }),
    );
  });

  it('redirects to /alerts on success', async () => {
    mockPost.mockResolvedValue({ data: MOCK_RULE });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    expect(mockPush).toHaveBeenCalledWith('/alerts');
  });

  it('invalidates the alerts cache', async () => {
    mockPost.mockResolvedValue({ data: MOCK_RULE });
    const { wrapper, qc } = createWrapper();
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(mockPush).toHaveBeenCalled());

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: queryKeys.alertRules.all }),
    );
  });
});

describe('useCreateAlertRule — error', () => {
  it('delegates API errors to useApiError', async () => {
    const error = new Error('server_error');
    mockPost.mockRejectedValue(error);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateAlertRule(), { wrapper });

    await act(async () => { result.current.createAlertRule(VALID_INPUT); });
    await waitFor(() => expect(mockHandleApiError).toHaveBeenCalled());

    expect(mockHandleApiError).toHaveBeenCalled();
    expect(mockHandleApiError.mock.calls[0][0]).toBe(error);
  });
});
