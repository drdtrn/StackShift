import { useCallback } from 'react';
import { isAxiosError } from 'axios';
import { ApiSchemaError } from '@/app/lib/api-client';
import { useToastStore } from '@/app/hooks/useToastStore';
import type { ApiError } from '@/app/types';

// ---------------------------------------------------------------------------
// useApiError
//
// Call this in TanStack Query mutation `onError` callbacks (and anywhere else
// an API error surfaces) to get consistent toast messages.
//
// Behaviour:
//   - ApiSchemaError in dev  → shows ZodError path so you can fix the schema
//   - ApiSchemaError in prod → "Service temporarily unavailable"
//   - RFC 7807 ProblemDetails → shows detail or title from the server body
//   - Unknown errors         → generic fallback message
//
// The correlation ID (echoed from X-Correlation-ID by CorrelationIdMiddleware)
// is appended when present — paste it into Grafana/Loki to find the trace.
// ---------------------------------------------------------------------------

export function useApiError() {
  const addToast = useToastStore((s) => s.addToast);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiSchemaError) {
        const isDev = process.env.NODE_ENV === 'development';

        if (isDev) {
          const firstIssue = err.zodError.issues[0];
          const path = firstIssue?.path.join(' → ') || 'unknown field';
          const expected = firstIssue?.message ?? 'unexpected shape';
          const correlationSuffix = err.correlationId
            ? ` (ID: ${err.correlationId.slice(0, 8)})`
            : '';
          addToast({
            variant: 'error',
            message: `Schema mismatch at "${path}": ${expected}${correlationSuffix}`,
          });
        } else {
          addToast({
            variant: 'error',
            message: 'Service temporarily unavailable. Please try again later.',
          });
        }
        return;
      }

      if (isAxiosError<ApiError>(err)) {
        // Global interceptor already toasts 4xx/5xx — only handle 404 here
        // (the interceptor intentionally skips 404 so callers can decide).
        if (err.response?.status === 404) {
          addToast({ variant: 'error', message: 'The requested resource was not found.' });
        }
        // All other status codes were already toasted by the global interceptor.
        return;
      }

      // Unexpected / network errors
      addToast({
        variant: 'error',
        message: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    },
    [addToast],
  );

  return handleError;
}
