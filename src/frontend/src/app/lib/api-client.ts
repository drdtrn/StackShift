import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/app/hooks/useAuthStore';
import { useToastStore } from '@/app/hooks/useToastStore';
import type { ApiError } from '@/app/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generates a UUID-like correlation ID (RFC 4122 v4 — crypto-quality). */
function generateCorrelationId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Axios instance
//
// A single shared instance used across all query hooks and mutations.
// Base URL comes from the NEXT_PUBLIC_API_URL environment variable
// (set in .env.local from .env.local.example).
// ---------------------------------------------------------------------------

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5190',
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30_000,
});

// ---------------------------------------------------------------------------
// Request interceptor — attach auth token + correlation ID
//
// Reads the token directly from Zustand's getState() so this function
// works outside React components (e.g. from a query hook's queryFn).
// ---------------------------------------------------------------------------

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Every outbound request carries a unique correlation ID.
    // The backend (BE-16) echoes this in logs and responses,
    // enabling end-to-end tracing across services.
    config.headers['X-Correlation-ID'] = generateCorrelationId();

    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor — handle errors globally
//
// On 401: clear session (token expired / revoked by Keycloak) and show toast.
// On other 4xx/5xx: parse the ProblemDetails body and fire an error toast.
// Zod validation of individual endpoint responses happens in each query hook,
// not here — this interceptor handles the transport-level error envelope only.
// ---------------------------------------------------------------------------

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401) {
      useAuthStore.getState().reset();
      useToastStore.getState().addToast({
        variant: 'error',
        message: 'Your session has expired. Please log in again.',
      });
    } else if (status === 403) {
      useToastStore.getState().addToast({
        variant: 'error',
        message: 'You do not have permission to perform this action.',
      });
    } else if (status && status >= 400) {
      const message =
        data?.detail ??
        data?.title ??
        `Request failed with status ${status}.`;

      useToastStore.getState().addToast({
        variant: 'error',
        message,
      });
    }

    return Promise.reject(error);
  },
);
