import { makeQueryClient, createQueryClientWithErrorHandler } from '../query-client';
import { QueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mock
// ---------------------------------------------------------------------------

const mockAddToast = jest.fn();

jest.mock('@/app/hooks/useToastStore', () => ({
  useToastStore: {
    getState: () => ({ addToast: mockAddToast }),
  },
}));

// ---------------------------------------------------------------------------
// makeQueryClient
// ---------------------------------------------------------------------------

describe('makeQueryClient', () => {
  it('returns a QueryClient instance', () => {
    const qc = makeQueryClient();
    expect(qc).toBeInstanceOf(QueryClient);
  });

  it('sets staleTime to 30 seconds', () => {
    const qc = makeQueryClient();
    expect(qc.getDefaultOptions().queries?.staleTime).toBe(30_000);
  });

  it('sets mutation retry to 0', () => {
    const qc = makeQueryClient();
    expect(qc.getDefaultOptions().mutations?.retry).toBe(0);
  });

  it('each call returns a distinct instance', () => {
    const qc1 = makeQueryClient();
    const qc2 = makeQueryClient();
    expect(qc1).not.toBe(qc2);
  });
});

// ---------------------------------------------------------------------------
// createQueryClientWithErrorHandler
// ---------------------------------------------------------------------------

describe('createQueryClientWithErrorHandler', () => {
  beforeEach(() => mockAddToast.mockReset());

  it('returns a QueryClient instance', () => {
    const qc = createQueryClientWithErrorHandler();
    expect(qc).toBeInstanceOf(QueryClient);
  });

  it('sets staleTime to 30 seconds', () => {
    const qc = createQueryClientWithErrorHandler();
    expect(qc.getDefaultOptions().queries?.staleTime).toBe(30_000);
  });

  it('mutation cache fires an error toast on mutation failure', () => {
    const qc = createQueryClientWithErrorHandler();
    // Access the internal MutationCache and fire onError directly
    const mutationCache = qc.getMutationCache();
    // @ts-expect-error — accessing internal observer config for test purposes
    mutationCache.config.onError?.(new Error('test error'));
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' }),
    );
  });

  it('query cache fires an error toast when stale data exists', () => {
    const qc = createQueryClientWithErrorHandler();
    const queryCache = qc.getQueryCache();
    // Simulate a query with stale data (state.data !== undefined)
    const fakeQuery = { state: { data: 'stale-value' } } as Parameters<
      NonNullable<ConstructorParameters<typeof import('@tanstack/react-query').QueryCache>[0]['onError']>
    >[1];
    // @ts-expect-error — accessing internal observer config for test purposes
    queryCache.config.onError?.(new Error('network error'), fakeQuery);
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'error' }),
    );
  });

  it('query cache does NOT fire a toast when no stale data exists', () => {
    const qc = createQueryClientWithErrorHandler();
    const queryCache = qc.getQueryCache();
    const fakeQuery = { state: { data: undefined } } as Parameters<
      NonNullable<ConstructorParameters<typeof import('@tanstack/react-query').QueryCache>[0]['onError']>
    >[1];
    // @ts-expect-error — accessing internal observer config for test purposes
    queryCache.config.onError?.(new Error('network error'), fakeQuery);
    expect(mockAddToast).not.toHaveBeenCalled();
  });
});
