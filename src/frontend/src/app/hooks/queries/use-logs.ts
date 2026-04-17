import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/app/lib/query-keys';
import { MOCK_LOG_ENTRIES } from '@/app/lib/mock-data';
import type { LogEntry, LogQueryFilters, CursorPaginatedResponse } from '@/app/types';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// useLogEntries — paginated + filtered log list
//
// Supports cursor pagination: each call returns up to `limit` entries plus
// a `nextCursor` pointing at the next page. The cursor is the timestamp of
// the last entry in the current page (ISO string).
// ---------------------------------------------------------------------------

export function useLogEntries(
  filters: LogQueryFilters = {},
  limit = 20,
) {
  return useQuery<CursorPaginatedResponse<LogEntry>>({
    queryKey: queryKeys.logs.list(filters),
    queryFn: async () => {
      await delay(300);

      let results = [...MOCK_LOG_ENTRIES];

      // Apply filters
      if (filters.projectId) {
        results = results.filter((e) => e.projectId === filters.projectId);
      }
      if (filters.level) {
        results = results.filter((e) => e.level === filters.level);
      }
      if (filters.logSourceId) {
        results = results.filter((e) => e.logSourceId === filters.logSourceId);
      }
      if (filters.search) {
        const term = filters.search.toLowerCase();
        results = results.filter((e) =>
          e.message.toLowerCase().includes(term) ||
          e.serviceName?.toLowerCase().includes(term) ||
          e.hostName?.toLowerCase().includes(term),
        );
      }
      if (filters.startDate) {
        results = results.filter((e) => e.timestamp >= filters.startDate!);
      }
      if (filters.endDate) {
        results = results.filter((e) => e.timestamp <= filters.endDate!);
      }

      // Sort descending by timestamp (newest first)
      results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      const page = results.slice(0, limit);
      const hasMore = results.length > limit;
      const nextCursor = hasMore ? page[page.length - 1].timestamp : null;

      return { data: page, nextCursor, hasMore };
    },
  });
}

// ---------------------------------------------------------------------------
// useLogEntry — single log entry by ID
// ---------------------------------------------------------------------------

export function useLogEntry(id: string) {
  return useQuery<LogEntry>({
    queryKey: queryKeys.logs.detail(id),
    queryFn: async () => {
      await delay(300);
      const entry = MOCK_LOG_ENTRIES.find((e) => e.id === id);
      if (!entry) throw new Error(`Log entry not found: ${id}`);
      return entry;
    },
    enabled: Boolean(id),
  });
}
