import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { z } from 'zod';
import { useToastStore } from '@/app/hooks/useToastStore';
import { useAuthStore } from '@/app/hooks/useAuthStore';
import type { ApiError } from '@/app/types';

// ---------------------------------------------------------------------------
// ApiSchemaError
//
// Thrown by the response interceptor when the server response does not match
// the per-call Zod schema. Carries the ZodError so callers can inspect paths.
// The correlationId comes from the X-Correlation-ID header sent on the
// original request — SREs can paste it into Grafana/Loki to find the trace.
// ---------------------------------------------------------------------------

export class ApiSchemaError extends Error {
  readonly zodError: z.ZodError;
  readonly correlationId: string | null;

  constructor(zodError: z.ZodError, correlationId: string | null = null) {
    super(`API response did not match expected schema: ${zodError.message}`);
    this.name = 'ApiSchemaError';
    this.zodError = zodError;
    this.correlationId = correlationId;
  }
}

// ---------------------------------------------------------------------------
// Extend Axios config to carry a per-call response schema.
//
// Usage:
//   apiClient.get('/projects', { schema: ApiResponseSchema(z.array(ProjectSchema)) })
//
// The response interceptor reads `config.schema` and Zod-parses `response.data`.
// Omit the field to skip schema validation for that call.
// ---------------------------------------------------------------------------

declare module 'axios' {
  interface AxiosRequestConfig {
    schema?: z.ZodTypeAny;
    /** Set to true by the 401 retry logic to prevent infinite retry loops. */
    _retried?: boolean;
  }
}

// ---------------------------------------------------------------------------
// Bearer token cache
//
// The Axios request interceptor calls /api/auth/bearer before every outbound
// request. To avoid one round-trip per API call we keep the token in memory
// with a short TTL (55 seconds — just under Keycloak's default 60s window).
//
// Concurrent requests that arrive before the first fetch resolves share the
// same pending Promise, so only one round-trip is made regardless of burst.
// ---------------------------------------------------------------------------

const BEARER_TTL_MS = 55_000;

let cachedToken: string | null = null;
let cachedAt = 0;
let pendingFetch: Promise<string | null> | null = null;

async function fetchBearerToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && now - cachedAt < BEARER_TTL_MS) {
    return cachedToken;
  }

  if (pendingFetch) {
    return pendingFetch;
  }

  pendingFetch = (async () => {
    try {
      const res = await fetch('/api/auth/bearer', { cache: 'no-store' });
      if (!res.ok) {
        cachedToken = null;
        return null;
      }
      const body = (await res.json()) as { token?: string };
      cachedToken = body.token ?? null;
      cachedAt = Date.now();
      return cachedToken;
    } catch {
      cachedToken = null;
      return null;
    } finally {
      pendingFetch = null;
    }
  })();

  return pendingFetch;
}

/** Force the cache to expire so the next request re-fetches a fresh token. */
export function invalidateBearerCache(): void {
  cachedToken = null;
  cachedAt = 0;
  pendingFetch = null;
}

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5190',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30_000,
  // ASP.NET Core binds repeated keys (`levels=Error&levels=Warning`), not
  // bracket-suffixed ones (`levels[]=Error`). Override Axios's default
  // bracket serialiser to match the backend.
  paramsSerializer: {
    indexes: null,
  },
});

// ---------------------------------------------------------------------------
// Request interceptor — attach bearer token + correlation ID
//
// Fetches the token from /api/auth/bearer (reads HTTP-only session cookie
// server-side) instead of from Zustand/localStorage — prevents XSS token
// theft. Token is cached for BEARER_TTL_MS to avoid per-call overhead.
// ---------------------------------------------------------------------------

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await fetchBearerToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    config.headers['X-Correlation-ID'] = crypto.randomUUID();

    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor (success path) — Zod schema validation
//
// If the call included a `schema` in its config, parse `response.data`.
// On mismatch throw ApiSchemaError. On success, return the parsed data
// (which strips extra unknown fields — safe by default).
// ---------------------------------------------------------------------------

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    const schema = (response.config as { schema?: z.ZodTypeAny }).schema;
    if (!schema) return response;

    const result = schema.safeParse(response.data);
    if (!result.success) {
      const correlationId =
        (response.config.headers?.['X-Correlation-ID'] as string | undefined) ?? null;
      throw new ApiSchemaError(result.error, correlationId);
    }

    response.data = result.data;
    return response;
  },
  async (error: AxiosError<ApiError>) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const config = error.config;

    // -----------------------------------------------------------------------
    // 401 — silent refresh, then retry once.
    // If the retry also fails with 401, clear Zustand session and go to login.
    // -----------------------------------------------------------------------
    if (status === 401 && config && !config._retried) {
      config._retried = true;
      invalidateBearerCache();

      const freshToken = await fetchBearerToken();
      if (freshToken) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${freshToken}`;
        return apiClient.request(config);
      }

      // Refresh failed — clear client auth state and redirect
      useAuthStore.getState().reset();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    if (status === 401 && config?._retried) {
      // Second 401 after retry — session is truly gone
      useAuthStore.getState().reset();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    // -----------------------------------------------------------------------
    // 402 — plan limit reached; surface upgrade nudge
    // -----------------------------------------------------------------------
    if (status === 402) {
      const detail = data?.detail ?? data?.title ?? 'Plan limit reached.';
      useToastStore.getState().addToast({
        variant: 'warning',
        message: detail,
        duration: 10_000,
        action: { label: 'Upgrade your plan', href: '/settings/billing' },
      });
      return Promise.reject(error);
    }

    // -----------------------------------------------------------------------
    // 403 — permission denied toast; do NOT redirect
    // -----------------------------------------------------------------------
    if (status === 403) {
      useToastStore.getState().addToast({
        variant: 'error',
        message: 'You do not have permission to perform this action.',
      });
      return Promise.reject(error);
    }

    // -----------------------------------------------------------------------
    // 404 — not found; no global toast (let the caller render an empty state)
    // -----------------------------------------------------------------------
    if (status === 404) {
      return Promise.reject(error);
    }

    // -----------------------------------------------------------------------
    // Other 4xx / 5xx — parse ProblemDetails and show an error toast.
    // Include the correlation ID so an SRE can paste it into Grafana/Loki.
    // -----------------------------------------------------------------------
    if (status && status >= 400) {
      const correlationId = config?.headers?.['X-Correlation-ID'] as string | undefined;
      const baseMessage =
        data?.detail ?? data?.title ?? `Request failed with status ${status}.`;

      const message = correlationId
        ? `${baseMessage} (ID: ${correlationId.slice(0, 8)})`
        : baseMessage;

      useToastStore.getState().addToast({
        variant: 'error',
        message,
      });
    }

    return Promise.reject(error);
  },
);
