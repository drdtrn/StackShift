import { z } from 'zod';

// ---------------------------------------------------------------------------
// Pagination params
// ---------------------------------------------------------------------------

export interface OffsetPaginationParams {
  page: number;
  pageSize: number;
}

export interface CursorPaginationParams {
  cursor: string | null;
  limit: number;
}

// ---------------------------------------------------------------------------
// Response envelopes
// ---------------------------------------------------------------------------

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Error shape (matches backend ProblemDetails)
// ---------------------------------------------------------------------------

export interface ApiError {
  type: string;
  title: string;
  status: number;
  detail: string | null;
  traceId: string | null;
  errors: Record<string, string[]> | null;
}

// ---------------------------------------------------------------------------
// Log query filters
// ---------------------------------------------------------------------------

export interface LogQueryFilters {
  projectId?: string;
  level?: import('./domain').LogLevel;
  search?: string;
  startDate?: string;
  endDate?: string;
  logSourceId?: string;
}

// ---------------------------------------------------------------------------
// Zod schemas for runtime API response validation
// ---------------------------------------------------------------------------

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    success: z.boolean(),
    message: z.string().nullable(),
  });

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  });

export const CursorPaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    data: z.array(itemSchema),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });

export const ApiErrorSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().nullable(),
  traceId: z.string().nullable(),
  errors: z.record(z.array(z.string())).nullable(),
});

// ---------------------------------------------------------------------------
// Domain entity Zod schemas (for validating API responses at runtime)
// ---------------------------------------------------------------------------

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  color: z.string(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  logSourceCount: z.number().int().nonnegative(),
  activeIncidentCount: z.number().int().nonnegative(),
});

export const LogEntrySchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  logSourceId: z.string().uuid(),
  level: z.enum(['trace', 'debug', 'info', 'warning', 'error', 'critical']),
  message: z.string(),
  timestamp: z.string().datetime({ offset: true }),
  traceId: z.string().nullable(),
  spanId: z.string().nullable(),
  serviceName: z.string().nullable(),
  hostName: z.string().nullable(),
  metadata: z.record(z.unknown()),
});

export const AlertSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  alertRuleId: z.string().uuid().nullable(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string(),
  description: z.string(),
  firedAt: z.string().datetime({ offset: true }),
  acknowledgedAt: z.string().datetime({ offset: true }).nullable(),
  resolvedAt: z.string().datetime({ offset: true }).nullable(),
  incidentId: z.string().uuid().nullable(),
});

export const IncidentSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  status: z.enum(['open', 'acknowledged', 'resolved', 'closed']),
  title: z.string(),
  description: z.string().nullable(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  startedAt: z.string().datetime({ offset: true }),
  acknowledgedAt: z.string().datetime({ offset: true }).nullable(),
  resolvedAt: z.string().datetime({ offset: true }).nullable(),
  closedAt: z.string().datetime({ offset: true }).nullable(),
  assigneeId: z.string().uuid().nullable(),
  alertIds: z.array(z.string().uuid()),
  aiAnalysisId: z.string().uuid().nullable(),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1),
  avatarUrl: z.string().url().nullable(),
  role: z.enum(['owner', 'admin', 'member', 'viewer']),
  organizationId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  lastLoginAt: z.string().datetime({ offset: true }).nullable(),
});
