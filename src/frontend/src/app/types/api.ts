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
// Error shape (matches backend ProblemDetails / RFC 7807)
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
// Zod schemas — canonical definitions live in lib/api-schemas.ts.
// Re-exported here for backward compatibility.
// ---------------------------------------------------------------------------

export {
  ApiErrorSchema,
  ApiResponseSchema,
  PaginatedResponseSchema,
  CursorPaginatedResponseSchema,
  OrganizationSchema,
  ProjectSchema,
  LogSourceSchema,
  LogEntrySchema,
  AlertRuleSchema,
  AlertSchema,
  IncidentSchema,
  AiAnalysisSchema,
  UserSchema,
  DashboardStatsSchema,
} from '@/app/lib/api-schemas';

