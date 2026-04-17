// ---------------------------------------------------------------------------
// SignalR mock hub
//
// Provides a fake IHubConnection that emits typed events on randomised timers.
// Used when NEXT_PUBLIC_SIGNALR_MOCK=true so the UI can be developed and tested
// without a running .NET backend.
//
// Both real HubConnection and MockHub implement IHubConnection structurally,
// so useSignalR can use either without casts.
// ---------------------------------------------------------------------------

import { HubConnectionState } from '@microsoft/signalr';
import type { LogEntry, Alert, LogLevel, AlertSeverity } from '@/app/types';
import { MOCK_LOG_ENTRIES, MOCK_ALERTS } from '@/app/lib/mock-data';
import { HUB_METHOD_LOG_ENTRY, HUB_METHOD_ALERT } from '@/app/lib/signalr-config';

/* ─── IHubConnection ─────────────────────────────────────────────────────── */

/**
 * Narrow interface that covers only what useSignalR needs from HubConnection.
 * The real `HubConnection` satisfies this structurally; MockHub implements it.
 */
export interface IHubConnection {
  readonly state: HubConnectionState;
  start(): Promise<void>;
  stop(): Promise<void>;
  on(methodName: string, newMethod: (...args: unknown[]) => void): void;
  off(methodName: string, method?: (...args: unknown[]) => void): void;
  onclose(callback: (error?: Error) => void): void;
  onreconnecting(callback: (error?: Error) => void): void;
  onreconnected(callback: (connectionId?: string) => void): void;
}

/* ─── Weighted random helpers ────────────────────────────────────────────── */

function weightedRandom<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let rand = Math.random() * total;
  for (const [key, w] of entries) {
    rand -= w;
    if (rand <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

const LOG_LEVEL_WEIGHTS: Record<LogLevel, number> = {
  trace: 3,
  debug: 12,
  info: 45,
  warning: 20,
  error: 15,
  critical: 5,
};

const ALERT_SEVERITY_WEIGHTS: Record<AlertSeverity, number> = {
  low: 30,
  medium: 35,
  high: 25,
  critical: 10,
};

/* ─── Counter for unique mock IDs ────────────────────────────────────────── */

let _idCounter = 0;

/* ─── Mock event generators ──────────────────────────────────────────────── */

function generateLogEntry(): LogEntry {
  const template = MOCK_LOG_ENTRIES[Math.floor(Math.random() * MOCK_LOG_ENTRIES.length)];
  return {
    ...template,
    id: `mock-log-${++_idCounter}`,
    timestamp: new Date().toISOString(),
    level: weightedRandom(LOG_LEVEL_WEIGHTS),
  };
}

function generateAlert(): Alert {
  const template = MOCK_ALERTS[Math.floor(Math.random() * MOCK_ALERTS.length)];
  return {
    ...template,
    id: `mock-alert-${++_idCounter}`,
    firedAt: new Date().toISOString(),
    acknowledgedAt: null,
    resolvedAt: null,
    severity: weightedRandom(ALERT_SEVERITY_WEIGHTS),
  };
}

/* ─── createMockHub ──────────────────────────────────────────────────────── */

/**
 * Factory that returns a mock hub implementing IHubConnection.
 *
 * On start():
 *   - Waits 300ms (simulates connection handshake)
 *   - Sets state → Connected
 *   - Begins emitting events on a variable-interval timer (2–5 s per AC2)
 *     80% probability: LogEntry on ReceiveLogEntry
 *     20% probability: Alert on ReceiveAlert
 *
 * On stop():
 *   - Clears the timer
 *   - Sets state → Disconnected
 *   - Invokes all registered onclose callbacks
 */
export function createMockHub(): IHubConnection {
  let _state: HubConnectionState = HubConnectionState.Disconnected;
  const _handlers = new Map<string, Set<(...args: unknown[]) => void>>();
  const _closeCallbacks: ((error?: Error) => void)[] = [];
  const _reconnectingCallbacks: ((error?: Error) => void)[] = [];
  const _reconnectedCallbacks: ((connectionId?: string) => void)[] = [];
  let _timerId: ReturnType<typeof setTimeout> | null = null;

  function emit(methodName: string, data: unknown): void {
    const handlers = _handlers.get(methodName);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(data);
    }
  }

  function scheduleNext(): void {
    const delay = Math.random() * 3_000 + 2_000; // 2–5 s
    _timerId = setTimeout(() => {
      if (_state !== HubConnectionState.Connected) return;
      if (Math.random() < 0.8) {
        emit(HUB_METHOD_LOG_ENTRY, generateLogEntry());
      } else {
        emit(HUB_METHOD_ALERT, generateAlert());
      }
      scheduleNext();
    }, delay);
  }

  return {
    get state() {
      return _state;
    },

    start(): Promise<void> {
      _state = HubConnectionState.Connecting;
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          _state = HubConnectionState.Connected;
          scheduleNext();
          resolve();
        }, 300);
      });
    },

    stop(): Promise<void> {
      if (_timerId !== null) {
        clearTimeout(_timerId);
        _timerId = null;
      }
      _state = HubConnectionState.Disconnected;
      for (const cb of _closeCallbacks) cb();
      return Promise.resolve();
    },

    on(methodName: string, handler: (...args: unknown[]) => void): void {
      if (!_handlers.has(methodName)) {
        _handlers.set(methodName, new Set());
      }
      _handlers.get(methodName)!.add(handler);
    },

    off(methodName: string, handler?: (...args: unknown[]) => void): void {
      if (!handler) {
        _handlers.delete(methodName);
        return;
      }
      _handlers.get(methodName)?.delete(handler);
    },

    onclose(callback: (error?: Error) => void): void {
      _closeCallbacks.push(callback);
    },

    onreconnecting(callback: (error?: Error) => void): void {
      _reconnectingCallbacks.push(callback);
    },

    onreconnected(callback: (connectionId?: string) => void): void {
      _reconnectedCallbacks.push(callback);
    },
  };
}
