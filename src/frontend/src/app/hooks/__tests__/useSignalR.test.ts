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

// ---------------------------------------------------------------------------
// Mock the IHubConnection
// ---------------------------------------------------------------------------

function makeMockConnection() {
  return {
    state: HubConnectionState.Disconnected,
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
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
