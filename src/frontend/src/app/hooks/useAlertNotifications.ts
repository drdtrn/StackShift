'use client';

import { useEffect } from 'react';
import { HubConnectionState } from '@microsoft/signalr';
import type { Alert, AlertSeverity } from '@/app/types';
import type { IHubConnection } from '@/app/lib/signalr-mock';
import type { ToastInput } from '@/app/hooks/useToastStore';
import { useToastStore } from '@/app/hooks/useToastStore';
import { HUB_METHOD_ALERT, SIGNALR_HUB_URL } from '@/app/lib/signalr-config';
import { useSignalR } from '@/app/hooks/useSignalR';

// ---------------------------------------------------------------------------
// useAlertNotifications
//
// Consumes useSignalR<Alert> and fires a toast notification for each received
// alert. Severity determines the toast variant, duration, and pulse animation.
//
// Severity → toast mapping (AC5):
//   critical → variant 'error', pulse: true, duration: null (must dismiss)
//   high     → variant 'error', duration: 8000 ms
//   medium   → variant 'warning', duration: 6000 ms
//   low      → variant 'info',    duration: 5000 ms
//
// This hook is mounted in AppShell for the entire dashboard session lifetime.
// It has no rendered output — its sole purpose is to drive toast side-effects.
// ---------------------------------------------------------------------------

const SEVERITY_TOAST_MAP: Record<
  AlertSeverity,
  Pick<ToastInput, 'variant' | 'duration' | 'pulse'>
> = {
  critical: { variant: 'error', pulse: true, duration: null },
  high:     { variant: 'error', duration: 8_000 },
  medium:   { variant: 'warning', duration: 6_000 },
  low:      { variant: 'info', duration: 5_000 },
};

export interface UseAlertNotificationsOptions {
  /** Injection point for tests. */
  connectionFactory?: () => IHubConnection;
}

export interface UseAlertNotificationsReturn {
  connectionState: HubConnectionState;
}

export function useAlertNotifications(
  options: UseAlertNotificationsOptions = {},
): UseAlertNotificationsReturn {
  const { connection, connectionState } = useSignalR({
    hubUrl: SIGNALR_HUB_URL,
    connectionFactory: options.connectionFactory,
  });

  useEffect(() => {
    const handler = (alert: Alert) => {
      const toastConfig = SEVERITY_TOAST_MAP[alert.severity];
      useToastStore.getState().addToast({
        ...toastConfig,
        message: `${alert.title}: ${alert.description}`,
      });
    };

    connection.on(HUB_METHOD_ALERT, handler as (...args: unknown[]) => void);
    return () => {
      connection.off(HUB_METHOD_ALERT, handler as (...args: unknown[]) => void);
    };
  }, [connection]);

  return { connectionState };
}
