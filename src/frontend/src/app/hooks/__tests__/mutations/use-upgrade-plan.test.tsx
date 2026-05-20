import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockPost = jest.fn();

jest.mock('@/app/lib/api-client', () => ({
  apiClient: { post: (...args: unknown[]) => mockPost(...args), get: jest.fn() },
  ApiSchemaError: class ApiSchemaError extends Error {},
  invalidateBearerCache: jest.fn(),
}));

import { useUpgradePlan } from '../../mutations/use-upgrade-plan';

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useUpgradePlan', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('sends Indie with capitalised plan and acquisition source', async () => {
    mockPost.mockResolvedValue({
      data: { sessionId: 'cs_1', url: 'https://checkout.stripe.com/cs_1' },
    });

    const { result } = renderHook(() => useUpgradePlan(), { wrapper: makeWrapper() });

    result.current.mutate({ plan: 'indie', from: 'marketing-hero' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/billing/checkout-session',
      { plan: 'Indie', from: 'marketing-hero' },
      expect.objectContaining({ schema: expect.anything() }),
    );
    expect(result.current.data?.url).toBe('https://checkout.stripe.com/cs_1');
  });

  it('sends Team capitalised and null from when not provided', async () => {
    mockPost.mockResolvedValue({
      data: { sessionId: 'cs_2', url: 'https://checkout.stripe.com/cs_2' },
    });

    const { result } = renderHook(() => useUpgradePlan(), { wrapper: makeWrapper() });

    result.current.mutate({ plan: 'team' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/billing/checkout-session',
      { plan: 'Team', from: null },
      expect.anything(),
    );
  });

  it('surfaces errors', async () => {
    mockPost.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useUpgradePlan(), { wrapper: makeWrapper() });
    result.current.mutate({ plan: 'indie' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
