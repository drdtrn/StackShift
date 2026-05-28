import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum schemas
// Lowercase values match JsonStringEnumConverter on the backend.
// ---------------------------------------------------------------------------

export const LogLevelSchema = z.enum(['trace', 'debug', 'info', 'warning', 'error', 'critical']);
export const AlertSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const IncidentStatusSchema = z.enum(['open', 'acknowledged', 'resolved', 'closed']);
export const UserRoleSchema = z.enum(['owner', 'admin', 'member', 'viewer']);
export const LogSourceTypeSchema = z.enum(['application', 'server', 'database', 'network', 'custom']);
export const AlertRuleConditionSchema = z.enum(['threshold', 'anomaly', 'pattern', 'absence']);
export const AiAnalysisStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);

// ---------------------------------------------------------------------------
// Domain entity schemas
// Mirror types/domain.ts exactly. Use z.infer<typeof Foo> for hook return
// types rather than duplicating the interface — single source of truth.
// ---------------------------------------------------------------------------

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1),
  logoUrl: z.string().url().nullable(),
  plan: z.enum(['free', 'indie', 'team']),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

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

export const LogSourceSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  type: LogSourceTypeSchema,
  ingestUrl: z.string().min(1),
  keyPrefix: z.string().min(1),
  keyLastUsedAt: z.string().datetime({ offset: true }).nullable(),
  keyRotatedAt: z.string().datetime({ offset: true }).nullable(),
  isActive: z.boolean(),
  lastSeenAt: z.string().datetime({ offset: true }).nullable(),
  createdAt: z.string().datetime({ offset: true }),
});

export const LogSourceCreatedSchema = z.object({
  logSource: LogSourceSchema,
  apiKey: z.string().min(1),
});

export const TestIngestResultSchema = z.object({
  syntheticId: z.string().uuid(),
  sentAt: z.string().datetime({ offset: true }),
});

export const LogEntrySchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  logSourceId: z.string().uuid(),
  level: LogLevelSchema,
  message: z.string(),
  timestamp: z.string().datetime({ offset: true }),
  traceId: z.string().nullable(),
  spanId: z.string().nullable(),
  serviceName: z.string().nullable(),
  hostName: z.string().nullable(),
  metadata: z.record(z.unknown()),
});

export const AlertRuleSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  condition: AlertRuleConditionSchema,
  threshold: z.number().nullable(),
  windowMinutes: z.number().int().positive(),
  logLevel: LogLevelSchema.nullable(),
  pattern: z.string().nullable(),
  isActive: z.boolean(),
  severity: AlertSeveritySchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export const AlertSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  alertRuleId: z.string().uuid().nullable(),
  severity: AlertSeveritySchema,
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
  organizationId: z.string().uuid(),
  status: IncidentStatusSchema,
  title: z.string(),
  description: z.string().nullable(),
  severity: AlertSeveritySchema,
  startedAt: z.string().datetime({ offset: true }),
  acknowledgedAt: z.string().datetime({ offset: true }).nullable(),
  resolvedAt: z.string().datetime({ offset: true }).nullable(),
  closedAt: z.string().datetime({ offset: true }).nullable(),
  assigneeId: z.string().uuid().nullable(),
  aiAnalysisId: z.string().uuid().nullable(),
});

export const AiAnalysisSchema = z.object({
  id: z.string().uuid(),
  incidentId: z.string().uuid(),
  projectId: z.string().uuid(),
  status: AiAnalysisStatusSchema,
  summary: z.string().nullable(),
  rootCause: z.string().nullable(),
  suggestedFixes: z.array(z.string()),
  relevantLogIds: z.array(z.string().uuid()),
  confidenceScore: z.number().min(0).max(1).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  completedAt: z.string().datetime({ offset: true }).nullable(),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1),
  avatarUrl: z.string().url().nullable(),
  role: UserRoleSchema,
  organizationId: z.string().uuid().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  lastLoginAt: z.string().datetime({ offset: true }).nullable(),
});

// Members management (NUF-5).
export const MemberSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1),
  role: UserRoleSchema,
  invitedByUserId: z.string().uuid().nullable(),
  invitedByDisplayName: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  lastLoginAt: z.string().datetime({ offset: true }).nullable(),
});

export const InvitationSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  email: z.string().email(),
  role: UserRoleSchema,
  invitedByUserId: z.string().uuid(),
  expiresAt: z.string().datetime({ offset: true }),
  createdAt: z.string().datetime({ offset: true }),
});

export const AddOrInviteMemberResultSchema = z.object({
  member: MemberSchema.nullable(),
  invitation: InvitationSchema.nullable(),
});

export const AcceptInvitationResultSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  organizationId: z.string().uuid(),
  role: UserRoleSchema,
});

// Dashboard stats — aggregated metrics returned by GET /api/v1/dashboard.
// Field names mirror DashboardStatsDto on the backend (camelCase via
// JsonSerializerDefaults.Web).
export const DashboardStatsSchema = z.object({
  activeAlertCount: z.number().int().nonnegative(),
  totalLogsToday: z.number().int().nonnegative(),
  openIncidentCount: z.number().int().nonnegative(),
});

// ---------------------------------------------------------------------------
// Response envelope schemas
// Generic factories so each call site declares its own shape.
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

// ---------------------------------------------------------------------------
// RFC 7807 ProblemDetails error schema
// Backend adds `traceId` (echoed from X-Correlation-ID via CorrelationIdMiddleware).
// ---------------------------------------------------------------------------

export const ApiErrorSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string().nullable(),
  instance: z.string().nullable().optional(),
  traceId: z.string().nullable().optional(),
  errors: z.record(z.array(z.string())).nullable().optional(),
});

// Similar incident — returned by GET /api/v1/incidents/{id}/similar
// score: cosine similarity (0-1); UI converts to percentage.
export const SimilarIncidentSchema = z.object({
  incident: IncidentSchema,
  score: z.number().min(0).max(1),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types (use these instead of duplicating in types/)
// ---------------------------------------------------------------------------

export type OrganizationFromSchema = z.infer<typeof OrganizationSchema>;
export type ProjectFromSchema = z.infer<typeof ProjectSchema>;
export type LogSourceFromSchema = z.infer<typeof LogSourceSchema>;
export type LogSourceCreatedFromSchema = z.infer<typeof LogSourceCreatedSchema>;
export type TestIngestResultFromSchema = z.infer<typeof TestIngestResultSchema>;
export type LogEntryFromSchema = z.infer<typeof LogEntrySchema>;
export type AlertRuleFromSchema = z.infer<typeof AlertRuleSchema>;
export type AlertFromSchema = z.infer<typeof AlertSchema>;
export type IncidentFromSchema = z.infer<typeof IncidentSchema>;
export type AiAnalysisFromSchema = z.infer<typeof AiAnalysisSchema>;
export type UserFromSchema = z.infer<typeof UserSchema>;
export type DashboardStatsFromSchema = z.infer<typeof DashboardStatsSchema>;
export type ApiErrorFromSchema = z.infer<typeof ApiErrorSchema>;
export type SimilarIncidentFromSchema = z.infer<typeof SimilarIncidentSchema>;
