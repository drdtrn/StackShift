import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { queryKeys } from '@/app/lib/query-keys';
import { apiClient } from '@/app/lib/api-client';
import {
  CursorPaginatedResponseSchema,
  LogEntrySchema,
} from '@/app/lib/api-schemas';
import type { CursorPaginatedResponse, LogEntry, LogQueryFilters } from '@/app/types';

const PAGE_LIMIT = 200;

// ---------------------------------------------------------------------------
// useLogEntries — cursor-paginated + filtered log list (infinite scroll)
//
// Calls GET /api/v1/logs?limit=200&cursor=<cursor>&<filters>
// The first page has cursor=undefined; subsequent pages pass nextCursor from
// the previous page. TanStack Query manages the page stack internally.
// ---------------------------------------------------------------------------

export function useLogEntries(filters: LogQueryFilters = {}) {
  return useInfiniteQuery<CursorPaginatedResponse<LogEntry>, AxiosError>({
    queryKey: queryKeys.logs.list(filters),
    queryFn: async ({ pageParam }) => {
      const { levels, level, ...rest } = filters;

      const params: Record<string, unknown> = {
        limit: PAGE_LIMIT,
        ...rest,
      };

      // Cursor forwarded on pages 2+
      if (pageParam) {
        params.cursor = pageParam;
      }

      // Multi-select severity: send as repeated `levels` params
      // (matches the backend's [FromQuery] LogLevel[]? levels binding).
      if (levels?.length) {
        params.levels = levels;
      } else if (level) {
        params.levels = [level];
      }

      const response = await apiClient.get<CursorPaginatedResponse<LogEntry>>(
        '/api/v1/logs',
        { schema: CursorPaginatedResponseSchema(LogEntrySchema), params },
      );
      return response.data;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}

// ---------------------------------------------------------------------------
// useLogEntry — single log entry by ID
//
// GET /api/v1/logs/{id} → LogEntry
// Disabled when id is empty (e.g. no row selected yet).
// ---------------------------------------------------------------------------

export function useLogEntry(id: string) {
  return useQuery<LogEntry, AxiosError>({
    queryKey: queryKeys.logs.detail(id),
    queryFn: async () => {
      const response = await apiClient.get<LogEntry>(
        `/api/v1/logs/${id}`,
        { schema: LogEntrySchema },
      );
      return response.data;
    },
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// useLogAppend — FS-09 seam for SignalR live append
//
// Returns a stable callback that prepends a new LogEntry to the first page of
// the infinite query cache for the given filters. Deduplicates by id so that
// an entry already fetched via REST is not double-rendered.
//
// Usage (in FS-09's SignalR handler):
//   const appendLog = useLogAppend(currentFilters);
//   connection.on('ReceiveLogEntry', appendLog);
// ---------------------------------------------------------------------------

export function useLogAppend(filters: LogQueryFilters = {}) {
  const queryClient = useQueryClient();

  return (entry: LogEntry): void => {
    const key = queryKeys.logs.list(filters);

    queryClient.setQueryData<InfiniteData<CursorPaginatedResponse<LogEntry>>>(
      key,
      (old) => {
        if (!old?.pages.length) return old;

        const firstPage = old.pages[0];
        const isDuplicate = firstPage.data.some((e) => e.id === entry.id);
        if (isDuplicate) return old;

        return {
          ...old,
          pages: [
            { ...firstPage, data: [entry, ...firstPage.data] },
            ...old.pages.slice(1),
          ],
        };
      },
    );
  };
}
