/**
 * Shared test utilities for StackSift frontend tests.
 *
 * Exports a custom `render` and `renderHook` that wrap the component tree in a
 * fresh QueryClient per test, preventing cache bleed-over between test cases.
 *
 * Also exports `createTestQueryClient` and `createWrapper` for tests that need
 * direct control over the QueryClient (e.g. to verify cache state post-mutation).
 *
 * All @testing-library/react utilities are re-exported so test files only need
 * a single import line:
 *   import { render, screen, waitFor } from '@/app/test-utils';
 */

import React, { useState } from 'react';
import {
  render as rtlRender,
  renderHook as rtlRenderHook,
  type RenderOptions,
  type RenderHookOptions,
} from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// QueryClient factory
// ---------------------------------------------------------------------------

/**
 * Creates a QueryClient configured for test isolation:
 *   - retry: false    — fail immediately instead of retrying 3 times
 *   - staleTime: Infinity — prevent background refetches that interfere with assertions
 *   - gcTime: 0       — immediately discard cached data between tests
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Wrapper factory (for renderHook)
// ---------------------------------------------------------------------------

/**
 * Returns a React component that wraps children in a QueryClientProvider.
 * Pass an existing QueryClient to share cache state across multiple hooks in
 * one test; omit to get a fresh client.
 */
export function createWrapper(queryClient?: QueryClient): React.ComponentType<{ children: React.ReactNode }> {
  const qc = queryClient ?? createTestQueryClient();
  return function TestWrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

// ---------------------------------------------------------------------------
// Custom render (for component tests)
// ---------------------------------------------------------------------------

function AllProviders({ children }: { children: React.ReactNode }) {
  // useState lazy initializer: creates QueryClient once per render tree,
  // stable across re-renders (React Compiler safe, no stale ref reads).
  const [qc] = useState(() => createTestQueryClient());
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

/**
 * Drop-in replacement for @testing-library/react's `render`.
 * Automatically wraps the component in a QueryClientProvider so hooks that
 * call useQuery/useMutation work without manual wrapper setup.
 */
export function render(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return rtlRender(ui, { wrapper: AllProviders, ...options });
}

// ---------------------------------------------------------------------------
// Custom renderHook (for hook tests that don't need cache inspection)
// ---------------------------------------------------------------------------

/**
 * Drop-in replacement for @testing-library/react's `renderHook`.
 * Wraps the hook in a fresh QueryClient unless a custom wrapper is provided.
 */
export function renderHook<T>(
  hook: () => T,
  options?: Omit<RenderHookOptions<unknown>, 'wrapper'> & {
    wrapper?: React.ComponentType<{ children: React.ReactNode }>;
  },
) {
  const wrapper = options?.wrapper ?? createWrapper();
  return rtlRenderHook(hook, { wrapper, ...options });
}

// ---------------------------------------------------------------------------
// Re-export everything from @testing-library/react
// ---------------------------------------------------------------------------

export * from '@testing-library/react';
