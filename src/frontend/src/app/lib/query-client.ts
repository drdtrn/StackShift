import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { useToastStore } from '@/app/hooks/useToastStore';

// ---------------------------------------------------------------------------
// QueryClient factory
//
// A factory function (not a singleton) is the App Router-recommended pattern.
// Each call produces a fresh QueryClient, which prevents shared cache state
// across SSR requests on the server side.
//
// On the client, Providers.tsx calls makeQueryClient() once and holds the
// instance in a ref to ensure stability across re-renders.
// ---------------------------------------------------------------------------

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data stays fresh for 30 seconds — prevents redundant refetches
        // when navigating between pages quickly.
        staleTime: 30 * 1_000,

        // Garbage-collect unused cache entries after 5 minutes.
        gcTime: 5 * 60 * 1_000,

        // Retry failed queries up to 3 times with exponential backoff.
        // Formula: min(1000 * 2^attempt, 30_000) ms
        retry: 3,
        retryDelay: (attemptIndex) =>
          Math.min(1_000 * 2 ** attemptIndex, 30_000),

        // Don't refetch on window focus in development — reduces noise.
        refetchOnWindowFocus: process.env.NODE_ENV === 'production',
      },

      mutations: {
        // Mutations don't retry by default — a failed write should surface
        // immediately rather than silently repeating.
        retry: 0,
      },
    },
    queryCache: undefined,
    mutationCache: undefined,
  });
}

// ---------------------------------------------------------------------------
// Global query error handler (used in Providers.tsx via QueryCache)
//
// Fires a toast for any query that fails WITHOUT its own onError handler.
// Individual query hooks can override by providing their own onError.
// ---------------------------------------------------------------------------

export function createQueryClientWithErrorHandler(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (_error, query) => {
        // Only toast if this query doesn't have a component-level onError
        if (query.state.data !== undefined) {
          useToastStore.getState().addToast({
            variant: 'error',
            message: 'Failed to refresh data. Showing stale results.',
          });
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: () => {
        useToastStore.getState().addToast({
          variant: 'error',
          message: 'Action failed. Please try again.',
        });
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30 * 1_000,
        gcTime: 5 * 60 * 1_000,
        retry: 3,
        retryDelay: (attemptIndex) =>
          Math.min(1_000 * 2 ** attemptIndex, 30_000),
        refetchOnWindowFocus: process.env.NODE_ENV === 'production',
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
