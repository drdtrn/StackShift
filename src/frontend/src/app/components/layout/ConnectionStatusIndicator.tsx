'use client';

import { HubConnectionState } from '@microsoft/signalr';
import { cn } from '@/app/lib/utils';
import { Spinner } from '@/app/components/ui/Spinner';
import { useSignalRStore } from '@/app/hooks/useSignalRStore';

// ---------------------------------------------------------------------------
// ConnectionStatusIndicator
//
// Reads SignalR connection state from useSignalRStore and renders a small
// status dot in the TopBar.
//
// Visual mapping (AC6):
//   Connected     → green dot
//   Connecting    → amber dot (pulsing)
//   Reconnecting  → amber dot + spinner
//   Disconnected  → red dot
//   Disconnecting → amber dot
// ---------------------------------------------------------------------------

const STATE_LABEL: Record<HubConnectionState, string> = {
  [HubConnectionState.Connected]:     'Connected',
  [HubConnectionState.Connecting]:    'Connecting',
  [HubConnectionState.Reconnecting]:  'Reconnecting',
  [HubConnectionState.Disconnected]:  'Disconnected',
  [HubConnectionState.Disconnecting]: 'Disconnecting',
};

const DOT_CLASS: Record<HubConnectionState, string> = {
  [HubConnectionState.Connected]:     'bg-green-500',
  [HubConnectionState.Connecting]:    'bg-amber-400 animate-pulse',
  [HubConnectionState.Reconnecting]:  'bg-amber-400',
  [HubConnectionState.Disconnected]:  'bg-red-500',
  [HubConnectionState.Disconnecting]: 'bg-amber-400',
};

export function ConnectionStatusIndicator() {
  const connectionState = useSignalRStore((s) => s.connectionState);
  const label = STATE_LABEL[connectionState];
  const isReconnecting = connectionState === HubConnectionState.Reconnecting;

  return (
    <div
      data-testid="connection-status-indicator"
      aria-label={`SignalR connection: ${label}`}
      title={`SignalR: ${label}`}
      className="flex items-center gap-1 px-1"
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full flex-shrink-0',
          DOT_CLASS[connectionState],
        )}
      />
      {isReconnecting && (
        <Spinner size="sm" className="text-amber-400" aria-hidden="true" />
      )}
    </div>
  );
}
