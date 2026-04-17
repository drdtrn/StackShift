import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLogEntries, useLogEntry } from '../../queries/use-logs';
import { MOCK_LOG_ENTRIES } from '../../../lib/mock-data';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ---------------------------------------------------------------------------
// useLogEntries
// ---------------------------------------------------------------------------

describe('useLogEntries', () => {
  it('returns loading state initially', () => {
    const { result } = renderHook(() => useLogEntries(), {
      wrapper: createWrapper(),
    });
    expect(result.current.isLoading).toBe(true);
  });

  it('returns paginated response with data array', async () => {
    const { result } = renderHook(() => useLogEntries(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveProperty('data');
    expect(result.current.data).toHaveProperty('hasMore');
    expect(result.current.data).toHaveProperty('nextCursor');
    expect(Array.isArray(result.current.data?.data)).toBe(true);
  });

  it('applies projectId filter', async () => {
    const projectId = '00000000-0000-0000-0002-000000000001';
    const { result } = renderHook(
      () => useLogEntries({ projectId }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const entries = result.current.data!.data;
    expect(entries.every((e) => e.projectId === projectId)).toBe(true);
  });

  it('applies level filter', async () => {
    const { result } = renderHook(
      () => useLogEntries({ level: 'error' }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const entries = result.current.data!.data;
    expect(entries.every((e) => e.level === 'error')).toBe(true);
  });

  it('applies search filter case-insensitively', async () => {
    const { result } = renderHook(
      () => useLogEntries({ search: 'keycloak' }),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const entries = result.current.data!.data;
    expect(entries.length).toBeGreaterThan(0);
    entries.forEach((e) => {
      const text = [e.message, e.serviceName, e.hostName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      expect(text).toMatch(/keycloak/i);
    });
  });

  it('returns results sorted newest first', async () => {
    const { result } = renderHook(() => useLogEntries(), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const entries = result.current.data!.data;
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i - 1].timestamp >= entries[i].timestamp).toBe(true);
    }
  });

  it('respects the limit parameter', async () => {
    const total = MOCK_LOG_ENTRIES.length;
    const limit = 5;
    const { result } = renderHook(
      () => useLogEntries({}, limit),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.data.length).toBeLessThanOrEqual(limit);
    if (total > limit) {
      expect(result.current.data!.hasMore).toBe(true);
      expect(result.current.data!.nextCursor).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// useLogEntry (single)
// ---------------------------------------------------------------------------

describe('useLogEntry', () => {
  it('returns the matching entry by ID', async () => {
    const target = MOCK_LOG_ENTRIES[0];
    const { result } = renderHook(() => useLogEntry(target.id), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(target.id);
    expect(result.current.data?.message).toBe(target.message);
  });

  it('errors when entry is not found', async () => {
    const { result } = renderHook(() => useLogEntry('ghost-id'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toMatch(/not found/i);
  });

  it('does not fetch when id is empty string', () => {
    const { result } = renderHook(() => useLogEntry(''), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });
});
