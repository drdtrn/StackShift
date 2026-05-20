// ---------------------------------------------------------------------------
// SignalR configuration
//
// Single source of truth for hub URLs, mock-mode flag, retry policy, and
// hub method name constants.
//
// Mock mode (NEXT_PUBLIC_SIGNALR_MOCK=true):
//   The real HubConnection is replaced by a fake hub in signalr-mock.ts that
//   emits typed events on setInterval timers. Swapping to the real backend is
//   a one-line change in .env.local when the .NET SignalR hub is ready.
// ---------------------------------------------------------------------------

/** True when running against the mock hub instead of the real .NET backend. */
export const IS_SIGNALR_MOCK: boolean =
  process.env.NEXT_PUBLIC_SIGNALR_MOCK === 'true';

/**
 * Base URL of the StackSift SignalR hub.
 * In real mode this connects a HubConnection via WebSockets.
 * In mock mode this value is passed to createMockHub() but never opened.
 */
export const SIGNALR_HUB_URL: string =
  process.env.NEXT_PUBLIC_SIGNALR_HUB_URL ?? 'http://localhost:5190/hubs/stacksift';

/**
 * Exponential back-off delays (ms) for withAutomaticReconnect().
 * Pattern: 1 s → 2 s → 4 s → 8 s → 16 s → 30 s (capped) × 5 more attempts.
 * Total: 10 attempts before the hub gives up.
 */
export const EXPONENTIAL_RETRY_DELAYS: number[] = Array.from(
  { length: 10 },
  (_, i) => Math.min(1_000 * Math.pow(2, i), 30_000),
);

/** Hub method broadcast by the server when a new log entry arrives. */
export const HUB_METHOD_LOG_ENTRY = 'ReceiveLogEntry' as const;

/** Hub method broadcast by the server when an alert fires. */
export const HUB_METHOD_ALERT = 'ReceiveAlert' as const;

/** Hub method broadcast by the server when an AI analysis completes. */
export const HUB_METHOD_AI_ANALYSIS_COMPLETED = 'ReceiveAiAnalysisCompleted' as const;

/** Hub method broadcast by the server when the org's subscription state changes. */
export const HUB_METHOD_SUBSCRIPTION_UPDATED = 'ReceiveSubscriptionUpdated' as const;
