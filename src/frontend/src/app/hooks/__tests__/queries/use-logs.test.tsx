import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLogEntries, useLogEntry, useLogAppend } from '../../queries/use-logs';
import type { CursorPaginatedResponse, LogEntry } from '@/app/types';

// ---------------------------------------------------------------------------
// Mock apiClient
// ---------------------------------------------------------------------------

// jest.mock() is hoisted before variable declarations, so mockGet must be
// obtained from the module AFTER the mock is registered.
jest.mock('@/app/lib/api-client', () => ({
  apiClient: { get: jest.fn() },
  ApiSchemaError: class ApiSchemaError extends Error {},
  invalidateBearerCache: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockGet = require('@/app/lib/api-client').apiClient.get as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ENTRY: LogEntry = {
  id: '00000000-0000-0000-0000-000000000001',
  projectId: '00000000-0000-0000-0002-000000000001',
  logSourceId: '00000000-0000-0000-0003-000000000001',
  level: 'error',
  message: 'Something exploded',
  timestamp: new Date().toISOString(),
  traceId: 'trace-abc',
  spanId: 'span-abc',
  serviceName: 'api-gateway',
  hostName: 'host-1',
  metadata: {},
};

const PAGE_1: CursorPaginatedResponse<LogEntry> = {
  data: [ENTRY],
  nextCursor: 'cursor-page-2',
  hasMore: true,
};

const PAGE_2: CursorPaginatedResponse<LogEntry> = {
  data: [{ ...ENTRY, id: '00000000-0000-0000-0000-000000000002', message: 'Second page' }],
  nextCursor: null,
  hasMore: false,
};

// ---------------------------------------------------------------------------
// Wrapper factory
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  });
  return {
    queryClient,
    wrapper: function Wrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );
    },
  };
}

// ---------------------------------------------------------------------------
// useLogEntries
// ---------------------------------------------------------------------------

describe('useLogEntries', () => {
  beforeEach(() => mockGet.mockReset());

  it('starts in loading state', () => {
    mockGet.mockResolvedValueOnce({ data: PAGE_1 });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useLogEntries(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('resolves the first page of entries', async () => {
    mockGet.mockResolvedValueOnce({ data: PAGE_1 });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useLogEntries(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0].data).toHaveLength(1);
    expect(result.current.data?.pages[0].data[0].id).toBe(ENTRY.id);
  });

  it('exposes hasNextPage from the cursor', async () => {
    mockGet.mockResolvedValueOnce({ data: PAGE_1 });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useLogEntries(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
  });

  it('passes projectId filter as a query param', async () => {
    mockGet.mockResolvedValueOnce({ data: PAGE_1 });
    const { wrapper } = createWrapper();
    renderHook(() => useLogEntries({ projectId: 'proj-1' }), { wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const [, config] = mockGet.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(config.params.projectId).toBe('proj-1');
  });

  it('passes single level filter', async () => {
    mockGet.mockResolvedValueOnce({ data: PAGE_1 });
    const { wrapper } = createWrapper();
    renderHook(() => useLogEntries({ level: 'error' }), { wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const [, config] = mockGet.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(config.params.level).toBe('error');
  });

  it('passes multi-level filter via levels array', async () => {
    mockGet.mockResolvedValueOnce({ data: PAGE_1 });
    const { wrapper } = createWrapper();
    renderHook(() => useLogEntries({ levels: ['error', 'critical'] }), { wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const [, config] = mockGet.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(config.params.level).toEqual(['error', 'critical']);
  });

  it('passes search filter', async () => {
    mockGet.mockResolvedValueOnce({ data: PAGE_1 });
    const { wrapper } = createWrapper();
    renderHook(() => useLogEntries({ search: 'keycloak' }), { wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const [, config] = mockGet.mock.calls[0] as [string, { params: Record<string, unknown> }];
    expect(config.params.search).toBe('keycloak');
  });

  it('sends cursor param when fetching the next page', async () => {
    // First call returns page 1; second returns page 2
    mockGet
      .mockResolvedValueOnce({ data: PAGE_1 })
      .mockResolvedValueOnce({ data: PAGE_2 });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useLogEntries(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    const [, secondConfig] = mockGet.mock.calls[1] as [string, { params: Record<string, unknown> }];
    expect(secondConfig.params.cursor).toBe(PAGE_1.nextCursor);
  });

  it('calls GET /api/v1/logs', async () => {
    mockGet.mockResolvedValueOnce({ data: PAGE_1 });
    const { wrapper } = createWrapper();
    renderHook(() => useLogEntries(), { wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet.mock.calls[0][0]).toBe('/api/v1/logs');
  });
});

// ---------------------------------------------------------------------------
// useLogEntry (single)
// ---------------------------------------------------------------------------

describe('useLogEntry', () => {
  beforeEach(() => mockGet.mockReset());

  it('fetches a single entry by id', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: ENTRY, success: true, message: null } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useLogEntry(ENTRY.id), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(ENTRY.id);
  });

  it('calls GET /api/v1/logs/{id}', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: ENTRY, success: true, message: null } });
    const { wrapper } = createWrapper();
    renderHook(() => useLogEntry(ENTRY.id), { wrapper });

    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    expect(mockGet.mock.calls[0][0]).toBe(`/api/v1/logs/${ENTRY.id}`);
  });

  it('is disabled when id is empty string', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useLogEntry(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

// ---------------------------------------------------------------------------
// useLogAppend (FS-09 seam)
// ---------------------------------------------------------------------------

describe('useLogAppend', () => {
  beforeEach(() => mockGet.mockReset());

  it('prepends a new entry to the first page in the cache', async () => {
    mockGet.mockResolvedValueOnce({ data: PAGE_1 });
    const { wrapper, queryClient } = createWrapper();

    // Populate the cache via useLogEntries
    const { result: queryResult } = renderHook(() => useLogEntries(), { wrapper });
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));

    // Get the appendLog function using the same empty-filter key
    const { result: appendResult } = renderHook(() => useLogAppend(), { wrapper });

    const newEntry: LogEntry = { ...ENTRY, id: 'new-live-entry', message: 'Live!' };
    appendResult.current(newEntry);

    // Read cache directly
    const cached = queryClient.getQueryData<{ pages: CursorPaginatedResponse<LogEntry>[] }>(
      ['logs', 'list', { filters: {} }],
    );
    expect(cached?.pages[0].data[0].id).toBe('new-live-entry');
  });

  it('deduplicates entries already in the cache', async () => {
    mockGet.mockResolvedValueOnce({ data: PAGE_1 });
    const { wrapper, queryClient } = createWrapper();

    const { result: queryResult } = renderHook(() => useLogEntries(), { wrapper });
    await waitFor(() => expect(queryResult.current.isSuccess).toBe(true));

    const { result: appendResult } = renderHook(() => useLogAppend(), { wrapper });
    // Append the same entry twice — second should be deduped
    appendResult.current(ENTRY);
    appendResult.current(ENTRY);

    const cached = queryClient.getQueryData<{ pages: CursorPaginatedResponse<LogEntry>[] }>(
      ['logs', 'list', { filters: {} }],
    );
    const count = cached?.pages[0].data.filter((e) => e.id === ENTRY.id).length;
    expect(count).toBe(1);
  });
});
