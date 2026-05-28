import React from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import type { AiAnalysisFromSchema } from '@/app/lib/api-schemas';
import { queryKeys } from '@/app/lib/query-keys';

const mockPost = jest.fn();

jest.mock('@/app/lib/api-client', () => ({
  apiClient: { post: (...args: Parameters<typeof mockPost>) => mockPost(...args) },
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

import { useTriggerAiAnalysis } from '@/app/hooks/mutations/use-trigger-ai-analysis';

function createHarness() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
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

const ANALYSIS: AiAnalysisFromSchema = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  incidentId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  projectId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  status: 'pending',
  summary: null,
  rootCause: null,
  suggestedFixes: [],
  relevantLogIds: [],
  confidenceScore: null,
  createdAt: '2026-05-19T00:00:00+00:00',
  completedAt: null,
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

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useTriggerAiAnalysis', () => {
  it('seeds the analysis cache and invalidates the parent incident on success', async () => {
    mockPost.mockResolvedValue({ data: ANALYSIS });

    const { qc, wrapper } = createHarness();
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useTriggerAiAnalysis(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ incidentId: ANALYSIS.incidentId });
    });

    expect(mockPost).toHaveBeenCalledWith(
      `/api/v1/incidents/${ANALYSIS.incidentId}/analyze`,
      undefined,
      expect.objectContaining({ schema: expect.anything() }),
    );
    expect(qc.getQueryData(queryKeys.aiAnalyses.detail(ANALYSIS.id))).toEqual(ANALYSIS);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: queryKeys.incidents.detail(ANALYSIS.incidentId),
    });
  });

  it('does not delegate 402 to useApiError (global interceptor surfaces the upgrade toast)', async () => {
    mockPost.mockRejectedValue(makeAxiosError(402));

    const { wrapper } = createHarness();
    const { result } = renderHook(() => useTriggerAiAnalysis(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ incidentId: 'x' });
      } catch {
        // expected
      }
    });

    expect(mockHandleError).not.toHaveBeenCalled();
    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it('delegates non-402 errors to useApiError', async () => {
    mockPost.mockRejectedValue(makeAxiosError(500));

    const { wrapper } = createHarness();
    const { result } = renderHook(() => useTriggerAiAnalysis(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ incidentId: 'x' });
      } catch {
        // expected
      }
    });

    await waitFor(() => expect(mockHandleError).toHaveBeenCalled());
    expect(mockAddToast).not.toHaveBeenCalled();
  });

  it('starts as not pending and not error before mutation is fired', () => {
    const { wrapper } = createHarness();
    const { result } = renderHook(() => useTriggerAiAnalysis(), { wrapper });
    expect(result.current.isPending).toBe(false);
    expect(result.current.isError).toBe(false);
  });
});
