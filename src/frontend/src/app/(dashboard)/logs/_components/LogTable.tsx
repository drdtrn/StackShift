'use client';

import { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { UseInfiniteQueryResult, InfiniteData } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { AlertCircle } from 'lucide-react';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { LogTableRow, LogTableRowSkeleton } from './LogTableRow';
import type { CursorPaginatedResponse, LogEntry } from '@/app/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SKELETON_COUNT = 20;
const LOAD_MORE_THRESHOLD_PX = 500;
const ROW_ESTIMATE_PX = 44; // ~1-line log entry; virtualiser re-measures on expand

// ---------------------------------------------------------------------------
// LogTable
// ---------------------------------------------------------------------------

export interface LogTableProps {
  query: UseInfiniteQueryResult<InfiniteData<CursorPaginatedResponse<LogEntry>>, AxiosError>;
  /** Called by the scroll-to-top effect after the first SignalR append (FS-09 seam). */
  appendLog: (entry: LogEntry) => void;
  onResetFilters: () => void;
}

export function LogTable({ query, appendLog: _appendLog, onResetFilters }: LogTableProps) {
  const {
    data,
    isLoading,
    isError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = query;

  // Flatten all pages into a single list (newest first from API)
  const allRows: LogEntry[] = data?.pages.flatMap((p) => p.data) ?? [];

  const parentRef = useRef<HTMLDivElement>(null);

  // ── Virtualiser ──────────────────────────────────────────────────────────
  const virtualizer = useVirtualizer({
    count: allRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE_PX,
    overscan: 15, // render 15 rows beyond viewport — covers the 500px load trigger
  });

  // ── Infinite scroll: load next page 500 px before the bottom ────────────
  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    function handleScroll() {
      if (!container) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (
        scrollHeight - scrollTop - clientHeight < LOAD_MORE_THRESHOLD_PX &&
        hasNextPage &&
        !isFetchingNextPage
      ) {
        fetchNextPage();
      }
    }

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ── Scroll to top when filters change (first page reloads) ──────────────
  useEffect(() => {
    if (data?.pages.length === 1) {
      parentRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [data?.pages.length]);

  // ── appendLog seam for FS-09 ─────────────────────────────────────────────
  // The _appendLog prop is forwarded from LogsView which calls useLogAppend().
  // FS-09 will wire this to the SignalR ReceiveLogEntry event.
  // Suppressing the unused-var lint because this is an intentional seam:
  void _appendLog;

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="flex flex-col rounded-lg border border-line bg-zinc-950 overflow-hidden">
      {/* ── Column headers ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-line bg-surface text-xs text-muted font-medium shrink-0 select-none">
        <div className="w-3" />
        <div className="w-16">Time</div>
        <div className="w-14">Level</div>
        <div className="w-28">Service</div>
        <div className="flex-1">Message</div>
        <div className="w-4" />
      </div>

      {/* ── Skeleton (initial load) ──────────────────────────────────────── */}
      {isLoading && (
        <div role="status" aria-label="Loading log entries">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <LogTableRowSkeleton key={i} />
          ))}
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {isError && !isLoading && (
        <div className="flex flex-col items-center gap-2 p-8 text-sm text-zinc-400">
          <AlertCircle className="h-8 w-8 text-red-400" aria-hidden="true" />
          <p>Failed to load logs. Check your connection and try again.</p>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {!isLoading && !isError && allRows.length === 0 && (
        <EmptyState
          title="No logs match these filters"
          description="Try broadening your search or adjusting the time range."
          cta={{ label: 'Reset filters', onClick: onResetFilters }}
        />
      )}

      {/* ── Virtualized rows ─────────────────────────────────────────────── */}
      {!isLoading && allRows.length > 0 && (
        <div
          ref={parentRef}
          className="h-[calc(100vh-22rem)] min-h-64 overflow-y-auto"
          role="log"
          aria-label="Log entries"
          aria-live="polite"
          aria-relevant="additions"
        >
          <div
            style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
          >
            {virtualItems.map((item) => (
              <LogTableRow
                key={allRows[item.index].id}
                entry={allRows[item.index]}
                style={{
                  position: 'absolute',
                  top: item.start,
                  left: 0,
                  right: 0,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Loading more indicator ────────────────────────────────────────── */}
      {isFetchingNextPage && (
        <div className="px-3 py-2 text-xs text-muted text-center border-t border-line shrink-0 animate-pulse">
          Loading more entries…
        </div>
      )}

      {/* ── Row count footer ─────────────────────────────────────────────── */}
      {!isLoading && allRows.length > 0 && !isFetchingNextPage && (
        <div className="px-3 py-1.5 text-xs text-muted border-t border-line shrink-0 select-none">
          {allRows.length.toLocaleString()} entries loaded
          {hasNextPage ? ' — scroll down for more' : ' — all entries shown'}
        </div>
      )}
    </div>
  );
}
