'use client';

import { useState, useEffect, useRef } from 'react';
import { HubConnectionState } from '@microsoft/signalr';
import type { LogEntry } from '@/app/types';
import type { IHubConnection } from '@/app/lib/signalr-mock';
import { HUB_METHOD_LOG_ENTRY, SIGNALR_HUB_URL } from '@/app/lib/signalr-config';
import { useSignalR } from '@/app/hooks/useSignalR';
import { useSignalRConnectionFromContext } from '@/app/hooks/useSignalRConnectionContext';

// ---------------------------------------------------------------------------
// useLiveLogStream
//
// Consumes useSignalR<LogEntry> to provide a real-time stream of log entries.
//
// Features (AC3, AC4):
//   - Appends new LogEntry items to the list in real time
//   - Auto-scroll is triggered externally by the consumer on entries.length change
//   - pause() stops appending and instead buffers incoming entries
//   - resume() flushes the buffer back into the list
//   - entries are capped at MAX_ENTRIES to prevent unbounded memory growth
//
// Stale closure avoidance:
//   The ReceiveLogEntry handler is registered once in a useEffect. To read
//   current `isPaused` inside the handler without a stale closure, we keep
//   an `isPausedRef` in sync with the state value and read the ref instead.
//   The ref is only written in pause()/resume() (not during render) — safe.
// ---------------------------------------------------------------------------

/** Maximum number of entries to keep in memory (prevents unbounded growth). */
export const MAX_LOG_ENTRIES = 500;

export interface UseLiveLogStreamOptions {
  /** Injection point for tests — passed through to useSignalR. */
  connectionFactory?: () => IHubConnection;
}

export interface UseLiveLogStreamReturn {
  entries: LogEntry[];
  isPaused: boolean;
  /** Number of entries received while paused (shown as badge on resume button). */
  bufferedCount: number;
  pause: () => void;
  resume: () => void;
  connectionState: HubConnectionState;
}

export function useLiveLogStream(
  options: UseLiveLogStreamOptions = {},
): UseLiveLogStreamReturn {
  const contextConn = useSignalRConnectionFromContext();
  const effectiveFactory = options.connectionFactory ??
    (contextConn !== null ? () => contextConn : undefined);
  const { connection, connectionState } = useSignalR({
    hubUrl: SIGNALR_HUB_URL,
    connectionFactory: effectiveFactory,
    manageLifecycle: contextConn === null || options.connectionFactory !== undefined,
  });

  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [buffer, setBuffer] = useState<LogEntry[]>([]);

  // Ref keeps isPaused current inside the registered handler without a stale
  // closure (ref.current is read inside a callback, not during render).
  const isPausedRef = useRef(false);

  useEffect(() => {
    const handler = (entry: LogEntry) => {
      if (isPausedRef.current) {
        setBuffer((prev) => [...prev, entry]);
      } else {
        setEntries((prev) => {
          const next = [...prev, entry];
          // Cap to MAX_LOG_ENTRIES; trim oldest first.
          return next.length > MAX_LOG_ENTRIES
            ? next.slice(next.length - MAX_LOG_ENTRIES)
            : next;
        });
      }
    };

    connection.on(HUB_METHOD_LOG_ENTRY, handler as (...args: unknown[]) => void);
    return () => {
      connection.off(HUB_METHOD_LOG_ENTRY, handler as (...args: unknown[]) => void);
    };
  }, [connection]);

  const pause = () => {
    isPausedRef.current = true;
    setIsPaused(true);
  };

  const resume = () => {
    isPausedRef.current = false;
    setIsPaused(false);
    // Flush buffered entries into the visible list, respecting the cap.
    setEntries((prev) => {
      const combined = [...prev, ...buffer];
      return combined.length > MAX_LOG_ENTRIES
        ? combined.slice(combined.length - MAX_LOG_ENTRIES)
        : combined;
    });
    setBuffer([]);
  };

  return {
    entries,
    isPaused,
    bufferedCount: buffer.length,
    pause,
    resume,
    connectionState,
  };
}
