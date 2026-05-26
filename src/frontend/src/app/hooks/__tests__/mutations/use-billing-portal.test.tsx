import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockPost = jest.fn();

jest.mock('@/app/lib/api-client', () => ({
  apiClient: { post: (...args: unknown[]) => mockPost(...args), get: jest.fn() },
  ApiSchemaError: class ApiSchemaError extends Error {},
  invalidateBearerCache: jest.fn(),
}));

import { useBillingPortal } from '../../mutations/use-billing-portal';

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useBillingPortal', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  it('returns the portal URL on success and defaults to the Default flow', async () => {
    mockPost.mockResolvedValue({ data: { url: 'https://billing.stripe.com/p/session/abc' } });

    const { result } = renderHook(() => useBillingPortal(), { wrapper: makeWrapper() });
    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.url).toBe('https://billing.stripe.com/p/session/abc');
    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/billing/portal-session',
      { flow: 'Default' },
      expect.any(Object),
    );
  });

  it('forwards SubscriptionUpdate when requested', async () => {
    mockPost.mockResolvedValue({ data: { url: 'https://billing.stripe.com/p/session/upgrade' } });

    const { result } = renderHook(() => useBillingPortal(), { wrapper: makeWrapper() });
    result.current.mutate({ flow: 'SubscriptionUpdate' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/billing/portal-session',
      { flow: 'SubscriptionUpdate' },
      expect.any(Object),
    );
  });
});
