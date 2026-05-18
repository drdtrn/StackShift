'use client';

import { useState, useCallback } from 'react';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/app/components/ui/Badge';
import type { BadgeProps } from '@/app/components/ui/Badge';
import { cn } from '@/app/lib/utils';
import type { LogEntry, LogLevel } from '@/app/types';

// ---------------------------------------------------------------------------
// Level → Badge variant
// ---------------------------------------------------------------------------

const LEVEL_VARIANT: Record<LogLevel, BadgeProps['variant']> = {
  trace:    'neutral',
  debug:    'neutral',
  info:     'info',
  warning:  'medium',
  error:    'high',
  critical: 'critical',
};

// ---------------------------------------------------------------------------
// Timestamp helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diffMs / 1_000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// LogTableRow
// ---------------------------------------------------------------------------

export interface LogTableRowProps {
  entry: LogEntry;
  style?: React.CSSProperties;
}

export function LogTableRow({ entry, style }: LogTableRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyTraceId = useCallback(async () => {
    if (!entry.traceId) return;
    await navigator.clipboard.writeText(entry.traceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1_500);
  }, [entry.traceId]);

  return (
    <div
      style={style}
      className={cn(
        'flex items-start gap-2 px-3 py-2 border-b border-line text-xs font-mono',
        'hover:bg-elevated transition-colors cursor-default',
      )}
    >
      {/* Expand toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-0.5 shrink-0 text-muted hover:text-primary"
        aria-label={expanded ? 'Collapse log entry' : 'Expand log entry'}
      >
        {expanded
          ? <ChevronDown className="h-3 w-3" aria-hidden="true" />
          : <ChevronRight className="h-3 w-3" aria-hidden="true" />
        }
      </button>

      {/* Timestamp — relative label, absolute date in title for hover tooltip */}
      <time
        dateTime={entry.timestamp}
        title={absoluteTime(entry.timestamp)}
        className="shrink-0 text-zinc-500 tabular-nums w-16 select-none"
      >
        {relativeTime(entry.timestamp)}
      </time>

      {/* Level badge */}
      <Badge size="sm" variant={LEVEL_VARIANT[entry.level]} className="shrink-0 uppercase">
        {entry.level}
      </Badge>

      {/* Service name */}
      {entry.serviceName && (
        <span className="shrink-0 text-zinc-400 w-28 truncate" title={entry.serviceName}>
          {entry.serviceName}
        </span>
      )}

      {/* Message — one line truncated, expands on click */}
      <span
        className={cn(
          'flex-1 text-zinc-200 min-w-0',
          expanded ? 'whitespace-pre-wrap break-words' : 'truncate',
        )}
      >
        {entry.message}
      </span>

      {/* Copy trace ID */}
      {entry.traceId && (
        <button
          type="button"
          onClick={copyTraceId}
          title={`Copy trace ID: ${entry.traceId}`}
          className="shrink-0 text-muted hover:text-primary ml-1"
          aria-label="Copy trace ID to clipboard"
        >
          {copied
            ? <Check className="h-3 w-3 text-green-400" aria-hidden="true" />
            : <Copy className="h-3 w-3" aria-hidden="true" />
          }
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LogTableRowSkeleton — shown during initial fetch
// ---------------------------------------------------------------------------

export function LogTableRowSkeleton({ style }: { style?: React.CSSProperties }) {
  return (
    <div
      style={style}
      className="flex items-center gap-2 px-3 py-2 border-b border-line animate-pulse"
      aria-hidden="true"
    >
      <div className="h-3 w-3 rounded bg-elevated shrink-0" />
      <div className="h-3 w-16 rounded bg-elevated shrink-0" />
      <div className="h-3 w-12 rounded bg-elevated shrink-0" />
      <div className="h-3 w-24 rounded bg-elevated shrink-0" />
      <div className="h-3 flex-1 rounded bg-elevated" />
    </div>
  );
}
