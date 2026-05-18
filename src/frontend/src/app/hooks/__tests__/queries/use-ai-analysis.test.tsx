import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AiAnalysisFromSchema } from '@/app/lib/api-schemas';

const mockGet = jest.fn();

jest.mock('@/app/lib/api-client', () => ({
  apiClient: { get: (...args: Parameters<typeof mockGet>) => mockGet(...args) },
}));

import { useAiAnalysis } from '@/app/hooks/queries/use-ai-analysis';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const ANALYSIS_ID = '11111111-1111-1111-1111-111111111111';

const PENDING: AiAnalysisFromSchema = {
  id: ANALYSIS_ID,
  incidentId: '22222222-2222-2222-2222-222222222222',
  projectId: '33333333-3333-3333-3333-333333333333',
  status: 'pending',
  summary: null,
  rootCause: null,
  suggestedFixes: [],
  relevantLogIds: [],
  confidenceScore: null,
  createdAt: '2026-05-19T00:00:00+00:00',
  completedAt: null,
};

const COMPLETED: AiAnalysisFromSchema = {
  ...PENDING,
  status: 'completed',
  summary: 'Redis ran out of memory.',
  rootCause: 'Eviction policy set to noeviction.',
  suggestedFixes: ['Set maxmemory-policy to allkeys-lru'],
  confidenceScore: 0.91,
  completedAt: '2026-05-19T00:00:08+00:00',
};

describe('useAiAnalysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not fire when id is null', () => {
    const { result } = renderHook(() => useAiAnalysis(null), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('does not fire when id is undefined', () => {
    const { result } = renderHook(() => useAiAnalysis(undefined), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('calls GET /api/v1/ai-analyses/{id} once on mount when id is provided', async () => {
    mockGet.mockResolvedValueOnce({ data: COMPLETED });

    const { result } = renderHook(() => useAiAnalysis(ANALYSIS_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data?.status).toBe('completed'));
    expect(mockGet).toHaveBeenCalledWith(
      `/api/v1/ai-analyses/${ANALYSIS_ID}`,
      expect.objectContaining({ schema: expect.anything() }),
    );
  });

  it('polls every 5s while status is pending, stops on completed', async () => {
    mockGet
      .mockResolvedValueOnce({ data: PENDING })
      .mockResolvedValueOnce({ data: PENDING })
      .mockResolvedValueOnce({ data: COMPLETED });

    const { result } = renderHook(() => useAiAnalysis(ANALYSIS_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data?.status).toBe('pending'));
    expect(mockGet).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(5_000);
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));

    await jest.advanceTimersByTimeAsync(5_000);
    await waitFor(() => expect(result.current.data?.status).toBe('completed'));
    expect(mockGet).toHaveBeenCalledTimes(3);

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it('stops polling once status is failed', async () => {
    const FAILED: AiAnalysisFromSchema = { ...PENDING, status: 'failed' };
    mockGet.mockResolvedValueOnce({ data: FAILED });

    const { result } = renderHook(() => useAiAnalysis(ANALYSIS_ID), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.data?.status).toBe('failed'));
    expect(mockGet).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(30_000);
    expect(mockGet).toHaveBeenCalledTimes(1);
  });
});
