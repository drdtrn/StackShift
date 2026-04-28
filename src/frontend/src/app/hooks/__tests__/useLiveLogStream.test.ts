/**
 * Tests for the useLiveLogStream hook (US-09)
 *
 * Verifies:
 *   - Entries accumulate on ReceiveLogEntry events (AC3)
 *   - Pause prevents accumulation; bufferedCount increments (AC4)
 *   - Resume flushes buffered entries into visible list (AC4)
 *   - Entries are capped at MAX_LOG_ENTRIES
 *   - handler is cleaned up on unmount (AC9)
 */

import { renderHook, act } from '@testing-library/react';
import { HubConnectionState } from '@microsoft/signalr';
import { useLiveLogStream, MAX_LOG_ENTRIES } from '../useLiveLogStream';
import { useSignalRStore } from '../useSignalRStore';
import type { LogEntry } from '@/app/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockConnection() {
  return {
    state: HubConnectionState.Disconnected,
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    invoke: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    off: jest.fn(),
    onclose: jest.fn(),
    onreconnecting: jest.fn(),
    onreconnected: jest.fn(),
  };
}

function makeLogEntry(id: string): LogEntry {
  return {
    id,
    projectId: 'proj-1',
    logSourceId: 'src-1',
    level: 'info',
    message: `Test log ${id}`,
    timestamp: new Date().toISOString(),
    traceId: null,
    spanId: null,
    serviceName: 'test-service',
    hostName: 'test-host',
    metadata: {},
  };
}

// Reset Zustand store between tests
beforeEach(() => {
  useSignalRStore.setState({ connectionState: HubConnectionState.Disconnected });
});

// ---------------------------------------------------------------------------
// Helper: get the ReceiveLogEntry handler registered on the mock connection
// ---------------------------------------------------------------------------

function getLogHandler(
  conn: ReturnType<typeof makeMockConnection>,
): (entry: LogEntry) => void {
  const call = conn.on.mock.calls.find(
    ([method]: [string]) => method === 'ReceiveLogEntry',
  );
  if (!call) throw new Error('ReceiveLogEntry handler not registered');
  return call[1] as (entry: LogEntry) => void;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useLiveLogStream — initial state', () => {
  it('starts with empty entries', async () => {
    const conn = makeMockConnection();
    const { result } = renderHook(() =>
      useLiveLogStream({ connectionFactory: () => conn }),
    );
    await act(async () => { await conn.start.mock.results[0]?.value; });
    expect(result.current.entries).toHaveLength(0);
  });

  it('starts unpaused', async () => {
    const conn = makeMockConnection();
    const { result } = renderHook(() =>
      useLiveLogStream({ connectionFactory: () => conn }),
    );
    await act(async () => { await conn.start.mock.results[0]?.value; });
    expect(result.current.isPaused).toBe(false);
  });

  it('starts with bufferedCount = 0', async () => {
    const conn = makeMockConnection();
    const { result } = renderHook(() =>
      useLiveLogStream({ connectionFactory: () => conn }),
    );
    await act(async () => { await conn.start.mock.results[0]?.value; });
    expect(result.current.bufferedCount).toBe(0);
  });
});

describe('useLiveLogStream — live appending (AC3)', () => {
  it('appends an entry when ReceiveLogEntry fires', async () => {
    const conn = makeMockConnection();
    const { result } = renderHook(() =>
      useLiveLogStream({ connectionFactory: () => conn }),
    );
    await act(async () => { await conn.start.mock.results[0]?.value; });

    const handler = getLogHandler(conn);
    act(() => {
      handler(makeLogEntry('e1'));
    });
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].id).toBe('e1');
  });

  it('accumulates multiple entries in order', async () => {
    const conn = makeMockConnection();
    const { result } = renderHook(() =>
      useLiveLogStream({ connectionFactory: () => conn }),
    );
    await act(async () => { await conn.start.mock.results[0]?.value; });

    const handler = getLogHandler(conn);
    act(() => {
      handler(makeLogEntry('e1'));
      handler(makeLogEntry('e2'));
      handler(makeLogEntry('e3'));
    });
    expect(result.current.entries).toHaveLength(3);
    expect(result.current.entries.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
  });
});

describe('useLiveLogStream — pause/resume (AC4)', () => {
  it('calling pause() stops entries from appearing in list', async () => {
    const conn = makeMockConnection();
    const { result } = renderHook(() =>
      useLiveLogStream({ connectionFactory: () => conn }),
    );
    await act(async () => { await conn.start.mock.results[0]?.value; });

    const handler = getLogHandler(conn);
    act(() => { result.current.pause(); });
    act(() => { handler(makeLogEntry('e1')); });

    expect(result.current.entries).toHaveLength(0);
    expect(result.current.isPaused).toBe(true);
  });

  it('bufferedCount increments for each entry received while paused', async () => {
    const conn = makeMockConnection();
    const { result } = renderHook(() =>
      useLiveLogStream({ connectionFactory: () => conn }),
    );
    await act(async () => { await conn.start.mock.results[0]?.value; });

    const handler = getLogHandler(conn);
    act(() => { result.current.pause(); });
    act(() => {
      handler(makeLogEntry('b1'));
      handler(makeLogEntry('b2'));
    });

    expect(result.current.bufferedCount).toBe(2);
    expect(result.current.entries).toHaveLength(0);
  });

  it('resume() flushes buffered entries into the visible list', async () => {
    const conn = makeMockConnection();
    const { result } = renderHook(() =>
      useLiveLogStream({ connectionFactory: () => conn }),
    );
    await act(async () => { await conn.start.mock.results[0]?.value; });

    const handler = getLogHandler(conn);
    act(() => { result.current.pause(); });
    act(() => {
      handler(makeLogEntry('b1'));
      handler(makeLogEntry('b2'));
      handler(makeLogEntry('b3'));
    });
    act(() => { result.current.resume(); });

    expect(result.current.entries).toHaveLength(3);
    expect(result.current.bufferedCount).toBe(0);
    expect(result.current.isPaused).toBe(false);
  });

  it('resume() preserves pre-pause entries', async () => {
    const conn = makeMockConnection();
    const { result } = renderHook(() =>
      useLiveLogStream({ connectionFactory: () => conn }),
    );
    await act(async () => { await conn.start.mock.results[0]?.value; });

    const handler = getLogHandler(conn);
    // 2 entries before pause
    act(() => {
      handler(makeLogEntry('before-1'));
      handler(makeLogEntry('before-2'));
    });
    act(() => { result.current.pause(); });
    act(() => { handler(makeLogEntry('buffered-1')); });
    act(() => { result.current.resume(); });

    expect(result.current.entries).toHaveLength(3);
  });
});

describe('useLiveLogStream — entry cap', () => {
  it('caps entries at MAX_LOG_ENTRIES', async () => {
    const conn = makeMockConnection();
    const { result } = renderHook(() =>
      useLiveLogStream({ connectionFactory: () => conn }),
    );
    await act(async () => { await conn.start.mock.results[0]?.value; });

    const handler = getLogHandler(conn);
    act(() => {
      // Push MAX_LOG_ENTRIES + 5 entries
      for (let i = 0; i < MAX_LOG_ENTRIES + 5; i++) {
        handler(makeLogEntry(`e${i}`));
      }
    });

    expect(result.current.entries).toHaveLength(MAX_LOG_ENTRIES);
    // Should keep the newest entries (trimmed from front)
    expect(result.current.entries[MAX_LOG_ENTRIES - 1].id).toBe(
      `e${MAX_LOG_ENTRIES + 4}`,
    );
  });
});

describe('useLiveLogStream — cleanup (AC9)', () => {
  it('calls off() for ReceiveLogEntry on unmount', async () => {
    const conn = makeMockConnection();
    const { unmount } = renderHook(() =>
      useLiveLogStream({ connectionFactory: () => conn }),
    );
    await act(async () => { await conn.start.mock.results[0]?.value; });
    act(() => { unmount(); });

    const offCalls = conn.off.mock.calls.filter(
      ([method]: [string]) => method === 'ReceiveLogEntry',
    );
    expect(offCalls).toHaveLength(1);
  });
});
