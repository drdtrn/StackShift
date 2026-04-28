'use client';

import { useState, useEffect } from 'react';
import { HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';
import type { IHubConnection } from '@/app/lib/signalr-mock';
import { createMockHub } from '@/app/lib/signalr-mock';
import {
  IS_SIGNALR_MOCK,
  EXPONENTIAL_RETRY_DELAYS,
} from '@/app/lib/signalr-config';
import { useSignalRStore } from '@/app/hooks/useSignalRStore';
import { useUIStore } from '@/app/hooks/useUIStore';

// ---------------------------------------------------------------------------
// useSignalR
//
// Generic hook that manages a SignalR hub connection lifecycle:
//   - Connects on mount (real or mock hub depending on IS_SIGNALR_MOCK)
//   - Registers reconnecting / reconnected / close callbacks
//   - Exposes the stable `connection` reference for consumers to call `.on()`
//   - Writes connection state to useSignalRStore for the TopBar indicator
//   - Disconnects (and clears all timers) on unmount — no memory leaks
//
// Mock mode (IS_SIGNALR_MOCK=true):
//   Returns a createMockHub() instance that emits fake events on setInterval.
//
// Testing:
//   Pass `connectionFactory` to inject a controllable mock without touching env.
// ---------------------------------------------------------------------------

export interface UseSignalROptions {
  hubUrl: string;
  /** Injection point for tests — bypasses env flag branching entirely. */
  connectionFactory?: () => IHubConnection;
}

export interface UseSignalRReturn {
  /** Stable connection reference — call .on() / .off() in consumer effects. */
  connection: IHubConnection;
  /** Current SignalR connection state, updated on every transition. */
  connectionState: HubConnectionState;
}

export function useSignalR({ hubUrl, connectionFactory }: UseSignalROptions): UseSignalRReturn {
  // Create the connection once (lazy initializer — React Compiler safe, never
  // reads from a ref during render).
  const [connection] = useState<IHubConnection>(() => {
    if (connectionFactory) return connectionFactory();
    // Guard: HubConnectionBuilder uses CJS require() internally which crashes
    // Turbopack during SSR prerendering. Return the mock hub as a safe SSR
    // placeholder — useEffect (client-only) never runs on the server, so the
    // mock is never started. On the client, typeof window is defined and the
    // real connection is created during hydration.
    if (IS_SIGNALR_MOCK || typeof window === 'undefined') return createMockHub();
    return new HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: async () => {
          const r = await fetch('/api/auth/token', { cache: 'no-store' });
          if (!r.ok) return '';
          const { accessToken } = (await r.json()) as { accessToken: string };
          return accessToken;
        },
      })
      .withAutomaticReconnect(EXPONENTIAL_RETRY_DELAYS)
      .build() as unknown as IHubConnection;
  });

  const [connectionState, setConnectionState] = useState<HubConnectionState>(
    HubConnectionState.Disconnected,
  );

  useEffect(() => {
    const updateState = (state: HubConnectionState) => {
      setConnectionState(state);
      useSignalRStore.getState().setConnectionState(state);
    };

    connection.onreconnecting(() => {
      updateState(HubConnectionState.Reconnecting);
    });

    connection.onreconnected(() => {
      updateState(HubConnectionState.Connected);
    });

    connection.onclose(() => {
      updateState(HubConnectionState.Disconnected);
    });

    updateState(HubConnectionState.Connecting);

    connection
      .start()
      .then(() => {
        updateState(HubConnectionState.Connected);
      })
      .catch((err: unknown) => {
        console.error('[useSignalR] connection failed:', err);
        updateState(HubConnectionState.Disconnected);
      });

    return () => {
      void connection.stop();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // `connection` is stable (created in useState lazy init) — safe to omit.

  // Project group subscription — keeps this connection in sync with the
  // user's active project. Server broadcasts to `project-{projectId}` groups.
  const activeProjectId = useUIStore((s) => s.activeProjectId);
  useEffect(() => {
    if (connectionState !== HubConnectionState.Connected || !activeProjectId) return;

    void connection
      .invoke('JoinProjectGroup', activeProjectId)
      .catch((err: unknown) => {
        console.warn('[useSignalR] JoinProjectGroup failed:', err);
      });
    
    const projectId = activeProjectId;
    return () => {
      void connection
        .invoke('LeaveProjectGroup', projectId)
        .catch((err: unknown) => {
          console.warn('[useSignalR] LeaveProjectGroup failed:', err);
        });
    };
  }, [connection, connectionState, activeProjectId])

  return { connection, connectionState };
}
