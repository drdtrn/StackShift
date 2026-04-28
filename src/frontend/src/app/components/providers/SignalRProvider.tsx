'use client';

import { useSignalR } from '@/app/hooks/useSignalR';
import { SignalRConnectionContext } from '@/app/hooks/useSignalRConnectionContext';
import { SIGNALR_HUB_URL } from '@/app/lib/signalr-config';

/**
 * Owns the single shared SignalR connection for the dashboard session.
 * All child components that consume useAlertNotifications or useLiveLogStream
 * receive the same connection via context — one WebSocket, not N.
 */
export function SignalRProvider({ children }: { children: React.ReactNode }) {
  const { connection } = useSignalR({ hubUrl: SIGNALR_HUB_URL });
  return (
    <SignalRConnectionContext.Provider value={connection}>
      {children}
    </SignalRConnectionContext.Provider>
  );
}
