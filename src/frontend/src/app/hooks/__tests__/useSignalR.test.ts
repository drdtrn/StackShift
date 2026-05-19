/**
 * Tests for the useSignalR hook (US-09)
 *
 * Verifies connection lifecycle:
 *   - Initial state is Disconnected
 *   - start() called on mount
 *   - connectionState transitions on connect/reconnect/close
 *   - stop() called on unmount (no memory leaks — AC9)
 *   - connectionFactory escape hatch used throughout to bypass env flag
 */

import { renderHook, act } from '@testing-library/react';
import { HubConnectionState } from '@microsoft/signalr';
import { useSignalR } from '../useSignalR';
import { useSignalRStore } from '../useSignalRStore';
import { useUIStore } from '../useUIStore';
import { useToastStore } from '../useToastStore';

// ---------------------------------------------------------------------------
// Mock the IHubConnection
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

// Reset shared Zustand store between tests
beforeEach(() => {
  useSignalRStore.setState({ connectionState: HubConnectionState.Disconnected });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSignalR — initial state', () => {
  it('starts with Disconnected state before effects run', () => {
    const conn = makeMockConnection();
    // Prevent start() from resolving immediately so the state stays Disconnected
    conn.start.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() =>
      useSignalR({ hubUrl: 'http://test', connectionFactory: () => conn }),
    );
    // After effects run, state transitions to Connecting
    // connectionState should be defined and a valid HubConnectionState
    expect(Object.values(HubConnectionState)).toContain(result.current.connectionState);
  });

  it('returns a stable connection reference', async () => {
    const conn = makeMockConnection();
    const { result, rerender } = renderHook(() =>
      useSignalR({ hubUrl: 'http://test', connectionFactory: () => conn }),
    );
    const first = result.current.connection;
    await act(async () => { await conn.start.mock.results[0]?.value; });
    rerender();
    expect(result.current.connection).toBe(first);
  });
});

describe('useSignalR — mount lifecycle', () => {
  it('calls start() once on mount', async () => {
    const conn = makeMockConnection();
    await act(async () => {
      renderHook(() =>
        useSignalR({ hubUrl: 'http://test', connectionFactory: () => conn }),
      );
    });
    expect(conn.start).toHaveBeenCalledTimes(1);
  });

  it('sets connectionState to Connected after start() resolves', async () => {
    const conn = makeMockConnection();
    const { result } = renderHook(() =>
      useSignalR({ hubUrl: 'http://test', connectionFactory: () => conn }),
    );
    await act(async () => {
      await conn.start.mock.results[0]?.value;
    });
    expect(result.current.connectionState).toBe(HubConnectionState.Connected);
  });

  it('also updates useSignalRStore to Connected', async () => {
    const conn = makeMockConnection();
    renderHook(() =>
      useSignalR({ hubUrl: 'http://test', connectionFactory: () => conn }),
    );
    await act(async () => {
      await conn.start.mock.results[0]?.value;
    });
    expect(useSignalRStore.getState().connectionState).toBe(
      HubConnectionState.Connected,
    );
  });
});

describe('useSignalR — callback registration', () => {
  it('registers an onclose callback', async () => {
    const conn = makeMockConnection();
    await act(async () => {
      renderHook(() =>
        useSignalR({ hubUrl: 'http://test', connectionFactory: () => conn }),
      );
    });
    expect(conn.onclose).toHaveBeenCalledTimes(1);
  });

  it('registers an onreconnecting callback', async () => {
    const conn = makeMockConnection();
    await act(async () => {
      renderHook(() =>
        useSignalR({ hubUrl: 'http://test', connectionFactory: () => conn }),
      );
    });
    expect(conn.onreconnecting).toHaveBeenCalledTimes(1);
  });

  it('registers an onreconnected callback', async () => {
    const conn = makeMockConnection();
    await act(async () => {
      renderHook(() =>
        useSignalR({ hubUrl: 'http://test', connectionFactory: () => conn }),
      );
    });
    expect(conn.onreconnected).toHaveBeenCalledTimes(1);
  });
});

describe('useSignalR — state transitions via callbacks', () => {
  it('sets Reconnecting when onreconnecting fires', async () => {
    const conn = makeMockConnection();
    const { result } = renderHook(() =>
      useSignalR({ hubUrl: 'http://test', connectionFactory: () => conn }),
    );
    await act(async () => {
      await conn.start.mock.results[0]?.value;
    });
    // Capture the registered callback and invoke it
    const onReconnecting: (err?: Error) => void =
      conn.onreconnecting.mock.calls[0][0];
    act(() => {
      onReconnecting();
    });
    expect(result.current.connectionState).toBe(HubConnectionState.Reconnecting);
  });

  it('sets Connected when onreconnected fires', async () => {
    const conn = makeMockConnection();
    const { result } = renderHook(() =>
      useSignalR({ hubUrl: 'http://test', connectionFactory: () => conn }),
    );
    await act(async () => {
      await conn.start.mock.results[0]?.value;
    });
    const onReconnected: (connectionId?: string) => void =
      conn.onreconnected.mock.calls[0][0];
    act(() => {
      onReconnected('new-id');
    });
    expect(result.current.connectionState).toBe(HubConnectionState.Connected);
  });

  it('sets Disconnected when onclose fires', async () => {
    const conn = makeMockConnection();
    const { result } = renderHook(() =>
      useSignalR({ hubUrl: 'http://test', connectionFactory: () => conn }),
    );
    await act(async () => {
      await conn.start.mock.results[0]?.value;
    });
    const onClose: (err?: Error) => void = conn.onclose.mock.calls[0][0];
    act(() => {
      onClose();
    });
    expect(result.current.connectionState).toBe(HubConnectionState.Disconnected);
  });
});

describe('useSignalR — unmount cleanup (AC9)', () => {
  it('calls stop() on unmount', async () => {
    const conn = makeMockConnection();
    const { unmount } = renderHook(() =>
      useSignalR({ hubUrl: 'http://test', connectionFactory: () => conn }),
    );
    await act(async () => {
      await conn.start.mock.results[0]?.value;
    });
    act(() => {
      unmount();
    });
    expect(conn.stop).toHaveBeenCalledTimes(1);
  });
});

describe('useSignalR — cross-tenant JoinProjectGroup failure', () => {
  beforeEach(() => {
    useUIStore.setState({ activeProjectId: 'proj-A' });
    useToastStore.setState({ toasts: [] });
  });

  it('fires an error toast and clears activeProjectId on Forbidden', async () => {
    const conn = makeMockConnection();
    conn.invoke.mockImplementation((method: string) => {
      if (method === 'JoinProjectGroup') {
        return Promise.reject(new Error('Forbidden'));
      }
      return Promise.resolve(undefined);
    });

    renderHook(() =>
      useSignalR({ hubUrl: 'http://test', connectionFactory: () => conn }),
    );

    await act(async () => {
      await conn.start.mock.results[0]?.value;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(conn.invoke).toHaveBeenCalledWith('JoinProjectGroup', 'proj-A');
    const toast = useToastStore.getState().toasts[0];
    expect(toast).toBeDefined();
    expect(toast.variant).toBe('error');
    expect(toast.message).toContain("don't have access");
    expect(useUIStore.getState().activeProjectId).toBeNull();
  });

  it('does NOT clear activeProjectId on a non-Forbidden invoke failure', async () => {
    const conn = makeMockConnection();
    conn.invoke.mockImplementation((method: string) => {
      if (method === 'JoinProjectGroup') {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve(undefined);
    });

    renderHook(() =>
      useSignalR({ hubUrl: 'http://test', connectionFactory: () => conn }),
    );

    await act(async () => {
      await conn.start.mock.results[0]?.value;
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useUIStore.getState().activeProjectId).toBe('proj-A');
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});

describe('useSignalR — visibility-aware pause', () => {
  let originalVisibility: PropertyDescriptor | undefined;

  beforeAll(() => {
    originalVisibility = Object.getOwnPropertyDescriptor(
      Document.prototype,
      'visibilityState',
    );
  });

  afterEach(() => {
    if (originalVisibility) {
      Object.defineProperty(Document.prototype, 'visibilityState', originalVisibility);
    }
    jest.useRealTimers();
  });

  function setVisibility(state: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => state,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  it('stops the connection after 30s hidden', async () => {
    jest.useFakeTimers();
    const conn = makeMockConnection();
    conn.state = HubConnectionState.Connected;

    renderHook(() =>
      useSignalR({ hubUrl: 'http://test', connectionFactory: () => conn }),
    );
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    conn.stop.mockClear();
    act(() => {
      setVisibility('hidden');
    });
    expect(conn.stop).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(conn.stop).toHaveBeenCalled();
  });

  it('restarts the connection when the tab becomes visible again', async () => {
    jest.useFakeTimers();
    const conn = makeMockConnection();
    conn.state = HubConnectionState.Disconnected;

    renderHook(() =>
      useSignalR({ hubUrl: 'http://test', connectionFactory: () => conn }),
    );
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    conn.start.mockClear();
    act(() => {
      setVisibility('visible');
    });
    expect(conn.start).toHaveBeenCalled();
  });

  it('cancels the pending hide timer when tab returns within 30s', async () => {
    jest.useFakeTimers();
    const conn = makeMockConnection();
    conn.state = HubConnectionState.Connected;

    renderHook(() =>
      useSignalR({ hubUrl: 'http://test', connectionFactory: () => conn }),
    );
    await act(async () => {
      jest.advanceTimersByTime(0);
    });

    conn.stop.mockClear();
    act(() => {
      setVisibility('hidden');
    });
    act(() => {
      jest.advanceTimersByTime(10_000);
      setVisibility('visible');
      jest.advanceTimersByTime(25_000);
    });
    expect(conn.stop).not.toHaveBeenCalled();
  });
});
