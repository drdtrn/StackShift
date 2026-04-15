'use client';

import { useRef, useEffect } from 'react';
import { HubConnectionState } from '@microsoft/signalr';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { Badge } from '@/app/components/ui/Badge';
import type { BadgeProps } from '@/app/components/ui/Badge';
import type { LogEntry, LogLevel } from '@/app/types';
import { useLiveLogStream } from '@/app/hooks/useLiveLogStream';

// ---------------------------------------------------------------------------
// LiveLogStream
//
// Real-time scrolling list of log entries powered by useLiveLogStream.
//
// Features (AC3, AC4):
//   - Auto-scrolls to the newest entry on each append (sentinel div technique)
//   - Pause button stops appending; buffered entries show "X new" badge
//   - Resume flushes the buffer back into the visible list
//   - Connection state displayed via a small coloured badge in the header
// ---------------------------------------------------------------------------

/* ─── Level → Badge variant mapping ─────────────────────────────────────── */

const LEVEL_VARIANT: Record<LogLevel, BadgeProps['variant']> = {
  trace:    'neutral',
  debug:    'neutral',
  info:     'info',
  warning:  'medium',
  error:    'high',
  critical: 'critical',
};

/* ─── Connection state label + colour ───────────────────────────────────── */

const STATE_STYLE: Record<
  HubConnectionState,
  { label: string; className: string }
> = {
  [HubConnectionState.Connected]:     { label: 'Live',          className: 'text-green-400' },
  [HubConnectionState.Connecting]:    { label: 'Connecting…',   className: 'text-amber-400' },
  [HubConnectionState.Reconnecting]:  { label: 'Reconnecting…', className: 'text-amber-400' },
  [HubConnectionState.Disconnected]:  { label: 'Disconnected',  className: 'text-red-400' },
  [HubConnectionState.Disconnecting]: { label: 'Disconnecting…',className: 'text-amber-400' },
};

/* ─── LogEntryRow ────────────────────────────────────────────────────────── */

interface LogEntryRowProps {
  entry: LogEntry;
}

function LogEntryRow({ entry }: LogEntryRowProps) {
  const time = new Date(entry.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="flex items-start gap-2 py-0.5 text-xs leading-5 font-mono">
      <span className="shrink-0 text-zinc-500 tabular-nums">{time}</span>
      <Badge size="sm" variant={LEVEL_VARIANT[entry.level]} className="shrink-0 uppercase">
        {entry.level}
      </Badge>
      {entry.serviceName && (
        <span className="shrink-0 text-zinc-400">{entry.serviceName}</span>
      )}
      <span className="text-zinc-200 min-w-0 break-words">{entry.message}</span>
    </div>
  );
}

/* ─── LiveLogStream ──────────────────────────────────────────────────────── */

export function LiveLogStream() {
  const { entries, isPaused, bufferedCount, pause, resume, connectionState } =
    useLiveLogStream();

  // Sentinel div at the bottom of the list — scrollIntoView keeps us current.
  // ref.current is only read inside useEffect (not during render — React Compiler safe).
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isPaused) {
      sentinelRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries.length, isPaused]);

  const stateInfo = STATE_STYLE[connectionState];

  return (
    <div className="flex flex-col gap-3">
      {/* Header: title + connection status + pause/resume button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Live Log Stream</h2>
          <span className={cn('text-xs font-medium', stateInfo.className)}>
            {stateInfo.label}
          </span>
        </div>

        <button
          type="button"
          onClick={isPaused ? resume : pause}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
            'border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
            isPaused
              ? 'border-blue-600 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20'
              : 'border-line bg-surface text-muted hover:bg-elevated hover:text-primary',
          )}
          aria-label={isPaused ? 'Resume live stream' : 'Pause live stream'}
        >
          {isPaused ? (
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {isPaused ? 'Resume' : 'Pause'}
          {isPaused && bufferedCount > 0 && (
            <span className="ml-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-xs leading-none text-white">
              {bufferedCount} new
            </span>
          )}
        </button>
      </div>

      {/* Scrollable log list */}
      <div
        className={cn(
          'h-[28rem] overflow-y-auto rounded-lg border border-line bg-zinc-950 p-3',
          'text-xs font-mono',
        )}
      >
        {entries.length === 0 ? (
          <p className="text-zinc-500 text-center py-8">
            Waiting for log entries…
          </p>
        ) : (
          entries.map((entry) => <LogEntryRow key={entry.id} entry={entry} />)
        )}
        {/* Scroll anchor — always at bottom of list */}
        <div ref={sentinelRef} aria-hidden="true" />
      </div>
    </div>
  );
}
