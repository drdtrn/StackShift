import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DashboardStatsFromSchema } from '@/app/lib/api-schemas';

const mockGet = jest.fn();

jest.mock('@/app/lib/api-client', () => ({
  apiClient: { get: (...args: Parameters<typeof mockGet>) => mockGet(...args) },
}));

import { useDashboardStats } from '@/app/hooks/queries/use-dashboard-stats';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const STATS: DashboardStatsFromSchema = {
  activeAlertCount: 3,
  totalLogsToday: 1024,
  openIncidentCount: 2,
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useDashboardStats', () => {
  it('calls GET /api/v1/dashboard with the DashboardStatsSchema config', async () => {
    mockGet.mockResolvedValue({ data: STATS });

    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith(
      '/api/v1/dashboard',
      expect.objectContaining({ schema: expect.anything() }),
    );
    expect(result.current.data).toEqual(STATS);
  });

  it('surfaces errors via TanStack Query state (toast handled by apiClient)', async () => {
    mockGet.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(Error);
  });

  it('returns isLoading=true before the first response', () => {
    mockGet.mockImplementation(() => new Promise<{ data: DashboardStatsFromSchema }>(() => {}));

    const { result } = renderHook(() => useDashboardStats(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
  });
});
