import type {
  Organization,
  Project,
  LogEntry,
  Alert,
  Incident,
  User,
} from '@/app/types';

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

export const MOCK_ORGANIZATIONS: Organization[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Acme Corp',
    slug: 'acme-corp',
    logoUrl: null,
    createdAt: '2025-01-15T09:00:00.000Z',
    updatedAt: '2025-03-20T14:00:00.000Z',
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Nexus Labs',
    slug: 'nexus-labs',
    logoUrl: null,
    createdAt: '2025-02-01T10:00:00.000Z',
    updatedAt: '2025-03-18T11:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const MOCK_USERS: User[] = [
  {
    id: '00000000-0000-0000-0001-000000000001',
    email: 'alice@acme-corp.com',
    displayName: 'Alice Nguyen',
    avatarUrl: null,
    role: 'owner',
    organizationId: '00000000-0000-0000-0000-000000000001',
    createdAt: '2025-01-15T09:00:00.000Z',
    lastLoginAt: '2026-04-03T08:00:00.000Z',
  },
  {
    id: '00000000-0000-0000-0001-000000000002',
    email: 'bob@acme-corp.com',
    displayName: 'Bob Patel',
    avatarUrl: null,
    role: 'admin',
    organizationId: '00000000-0000-0000-0000-000000000001',
    createdAt: '2025-01-20T10:00:00.000Z',
    lastLoginAt: '2026-04-02T17:30:00.000Z',
  },
  {
    id: '00000000-0000-0000-0001-000000000003',
    email: 'cara@acme-corp.com',
    displayName: 'Cara Smith',
    avatarUrl: null,
    role: 'member',
    organizationId: '00000000-0000-0000-0000-000000000001',
    createdAt: '2025-02-10T08:00:00.000Z',
    lastLoginAt: '2026-04-01T09:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const MOCK_PROJECTS: Project[] = [
  {
    id: '00000000-0000-0000-0002-000000000001',
    organizationId: '00000000-0000-0000-0000-000000000001',
    name: 'API Gateway',
    slug: 'api-gateway',
    description: 'Main customer-facing API and routing layer.',
    color: '#6366f1',
    createdAt: '2025-01-16T09:00:00.000Z',
    updatedAt: '2026-03-25T12:00:00.000Z',
    logSourceCount: 3,
    activeIncidentCount: 1,
  },
  {
    id: '00000000-0000-0000-0002-000000000002',
    organizationId: '00000000-0000-0000-0000-000000000001',
    name: 'Worker Service',
    slug: 'worker-service',
    description: 'Background job processor for async tasks.',
    color: '#f59e0b',
    createdAt: '2025-02-05T10:00:00.000Z',
    updatedAt: '2026-03-28T09:00:00.000Z',
    logSourceCount: 2,
    activeIncidentCount: 0,
  },
  {
    id: '00000000-0000-0000-0002-000000000003',
    organizationId: '00000000-0000-0000-0000-000000000001',
    name: 'Auth Service',
    slug: 'auth-service',
    description: 'Keycloak integration and session management.',
    color: '#10b981',
    createdAt: '2025-03-01T11:00:00.000Z',
    updatedAt: '2026-04-01T15:00:00.000Z',
    logSourceCount: 1,
    activeIncidentCount: 2,
  },
];

// ---------------------------------------------------------------------------
// Log Entries (25 entries, mix of all levels)
// ---------------------------------------------------------------------------

const P1 = '00000000-0000-0000-0002-000000000001';
const P2 = '00000000-0000-0000-0002-000000000002';
const P3 = '00000000-0000-0000-0002-000000000003';

export const MOCK_LOG_ENTRIES: LogEntry[] = [
  { id: 'log-001', projectId: P1, logSourceId: 'src-001', level: 'info', message: 'Server started on port 5190', timestamp: '2026-04-03T08:00:01.000Z', traceId: null, spanId: null, serviceName: 'api-gateway', hostName: 'prod-api-01', metadata: {} },
  { id: 'log-002', projectId: P1, logSourceId: 'src-001', level: 'debug', message: 'Database connection pool initialised: 20 connections', timestamp: '2026-04-03T08:00:02.000Z', traceId: null, spanId: null, serviceName: 'api-gateway', hostName: 'prod-api-01', metadata: { poolSize: 20 } },
  { id: 'log-003', projectId: P1, logSourceId: 'src-001', level: 'info', message: 'GET /api/projects 200 OK in 42ms', timestamp: '2026-04-03T08:01:00.000Z', traceId: 'trace-aaa', spanId: 'span-001', serviceName: 'api-gateway', hostName: 'prod-api-01', metadata: { method: 'GET', path: '/api/projects', statusCode: 200, durationMs: 42 } },
  { id: 'log-004', projectId: P1, logSourceId: 'src-001', level: 'warning', message: 'Slow query detected: 1230ms on SELECT * FROM log_entries', timestamp: '2026-04-03T08:05:00.000Z', traceId: 'trace-bbb', spanId: 'span-002', serviceName: 'api-gateway', hostName: 'prod-api-01', metadata: { durationMs: 1230, query: 'SELECT * FROM log_entries' } },
  { id: 'log-005', projectId: P1, logSourceId: 'src-001', level: 'error', message: 'Unhandled exception: NullReferenceException in LogController.GetById', timestamp: '2026-04-03T08:10:00.000Z', traceId: 'trace-ccc', spanId: 'span-003', serviceName: 'api-gateway', hostName: 'prod-api-01', metadata: { exception: 'NullReferenceException', controller: 'LogController' } },
  { id: 'log-006', projectId: P1, logSourceId: 'src-001', level: 'critical', message: 'Database connection pool exhausted — all 20 connections busy', timestamp: '2026-04-03T08:15:00.000Z', traceId: null, spanId: null, serviceName: 'api-gateway', hostName: 'prod-api-01', metadata: { poolSize: 20, activeConnections: 20 } },
  { id: 'log-007', projectId: P1, logSourceId: 'src-001', level: 'info', message: 'POST /api/logs/ingest 201 Created in 18ms', timestamp: '2026-04-03T08:20:00.000Z', traceId: 'trace-ddd', spanId: 'span-004', serviceName: 'api-gateway', hostName: 'prod-api-01', metadata: {} },
  { id: 'log-008', projectId: P1, logSourceId: 'src-001', level: 'trace', message: 'Entering LogController.GetById with id=log-001', timestamp: '2026-04-03T08:21:00.000Z', traceId: 'trace-ddd', spanId: 'span-005', serviceName: 'api-gateway', hostName: 'prod-api-01', metadata: {} },
  { id: 'log-009', projectId: P2, logSourceId: 'src-002', level: 'info', message: 'Worker started, listening on queue: log-ingestion', timestamp: '2026-04-03T08:00:05.000Z', traceId: null, spanId: null, serviceName: 'worker-service', hostName: 'prod-worker-01', metadata: { queue: 'log-ingestion' } },
  { id: 'log-010', projectId: P2, logSourceId: 'src-002', level: 'info', message: 'Processing batch: 150 log entries', timestamp: '2026-04-03T08:02:00.000Z', traceId: 'trace-eee', spanId: 'span-010', serviceName: 'worker-service', hostName: 'prod-worker-01', metadata: { batchSize: 150 } },
  { id: 'log-011', projectId: P2, logSourceId: 'src-002', level: 'warning', message: 'RabbitMQ consumer lag is 4200 messages', timestamp: '2026-04-03T08:08:00.000Z', traceId: null, spanId: null, serviceName: 'worker-service', hostName: 'prod-worker-01', metadata: { lag: 4200 } },
  { id: 'log-012', projectId: P2, logSourceId: 'src-002', level: 'error', message: 'Failed to parse log entry — invalid JSON payload', timestamp: '2026-04-03T08:09:00.000Z', traceId: 'trace-fff', spanId: 'span-011', serviceName: 'worker-service', hostName: 'prod-worker-01', metadata: { rawPayload: '{invalid}' } },
  { id: 'log-013', projectId: P2, logSourceId: 'src-002', level: 'info', message: 'Elasticsearch index refresh completed in 250ms', timestamp: '2026-04-03T08:11:00.000Z', traceId: null, spanId: null, serviceName: 'worker-service', hostName: 'prod-worker-01', metadata: { durationMs: 250 } },
  { id: 'log-014', projectId: P2, logSourceId: 'src-002', level: 'debug', message: 'Cache miss for key: project:00000000-0000-0000-0002-000000000002:stats', timestamp: '2026-04-03T08:12:00.000Z', traceId: null, spanId: null, serviceName: 'worker-service', hostName: 'prod-worker-01', metadata: { key: 'project:p2:stats' } },
  { id: 'log-015', projectId: P2, logSourceId: 'src-002', level: 'info', message: 'Batch complete: 150/150 entries indexed', timestamp: '2026-04-03T08:13:00.000Z', traceId: 'trace-eee', spanId: 'span-012', serviceName: 'worker-service', hostName: 'prod-worker-01', metadata: { batchSize: 150, indexed: 150 } },
  { id: 'log-016', projectId: P3, logSourceId: 'src-003', level: 'info', message: 'Keycloak realm stacksift loaded successfully', timestamp: '2026-04-03T08:00:10.000Z', traceId: null, spanId: null, serviceName: 'auth-service', hostName: 'prod-auth-01', metadata: { realm: 'stacksift' } },
  { id: 'log-017', projectId: P3, logSourceId: 'src-003', level: 'warning', message: 'Token validation failed: signature mismatch for client stacksift-frontend', timestamp: '2026-04-03T08:03:00.000Z', traceId: 'trace-ggg', spanId: 'span-020', serviceName: 'auth-service', hostName: 'prod-auth-01', metadata: { clientId: 'stacksift-frontend' } },
  { id: 'log-018', projectId: P3, logSourceId: 'src-003', level: 'error', message: 'User login failed: too many attempts — account locked (user: bob@acme-corp.com)', timestamp: '2026-04-03T08:04:00.000Z', traceId: 'trace-hhh', spanId: 'span-021', serviceName: 'auth-service', hostName: 'prod-auth-01', metadata: { userId: 'bob@acme-corp.com', attempts: 5 } },
  { id: 'log-019', projectId: P3, logSourceId: 'src-003', level: 'critical', message: 'OIDC discovery endpoint unreachable — upstream Keycloak is down', timestamp: '2026-04-03T08:16:00.000Z', traceId: null, spanId: null, serviceName: 'auth-service', hostName: 'prod-auth-01', metadata: { endpoint: 'http://localhost:8080/realms/stacksift/.well-known/openid-configuration' } },
  { id: 'log-020', projectId: P3, logSourceId: 'src-003', level: 'info', message: 'Keycloak reconnected after 180 seconds', timestamp: '2026-04-03T08:19:00.000Z', traceId: null, spanId: null, serviceName: 'auth-service', hostName: 'prod-auth-01', metadata: { downtimeSeconds: 180 } },
  { id: 'log-021', projectId: P1, logSourceId: 'src-001', level: 'warning', message: 'Redis cache eviction pressure: evicted 3420 keys in last 60s', timestamp: '2026-04-03T08:25:00.000Z', traceId: null, spanId: null, serviceName: 'api-gateway', hostName: 'prod-api-01', metadata: { evictedKeys: 3420 } },
  { id: 'log-022', projectId: P1, logSourceId: 'src-001', level: 'error', message: 'SignalR hub broadcast failed: client disconnected mid-stream', timestamp: '2026-04-03T08:26:00.000Z', traceId: 'trace-iii', spanId: 'span-030', serviceName: 'api-gateway', hostName: 'prod-api-01', metadata: {} },
  { id: 'log-023', projectId: P2, logSourceId: 'src-002', level: 'info', message: 'AI analysis job queued for incident-003', timestamp: '2026-04-03T08:30:00.000Z', traceId: null, spanId: null, serviceName: 'worker-service', hostName: 'prod-worker-01', metadata: { incidentId: 'incident-003' } },
  { id: 'log-024', projectId: P2, logSourceId: 'src-002', level: 'info', message: 'AI analysis completed in 8200ms — root cause identified', timestamp: '2026-04-03T08:30:08.000Z', traceId: null, spanId: null, serviceName: 'worker-service', hostName: 'prod-worker-01', metadata: { incidentId: 'incident-003', durationMs: 8200 } },
  { id: 'log-025', projectId: P3, logSourceId: 'src-003', level: 'debug', message: 'Refresh token rotation completed for user alice@acme-corp.com', timestamp: '2026-04-03T09:00:00.000Z', traceId: 'trace-jjj', spanId: 'span-040', serviceName: 'auth-service', hostName: 'prod-auth-01', metadata: {} },
];

// ---------------------------------------------------------------------------
// Alerts (5, varying severity)
// ---------------------------------------------------------------------------

export const MOCK_ALERTS: Alert[] = [
  { id: 'alert-001', projectId: P1, alertRuleId: 'rule-001', severity: 'critical', title: 'DB connection pool exhausted', description: 'All 20 connections in the pool are busy. New requests will queue or fail.', firedAt: '2026-04-03T08:15:00.000Z', acknowledgedAt: null, resolvedAt: null, incidentId: 'incident-001' },
  { id: 'alert-002', projectId: P1, alertRuleId: 'rule-002', severity: 'high', title: 'Error rate spike on API Gateway', description: 'Error rate exceeded 5% threshold over the last 5 minutes.', firedAt: '2026-04-03T08:10:00.000Z', acknowledgedAt: '2026-04-03T08:12:00.000Z', resolvedAt: null, incidentId: 'incident-001' },
  { id: 'alert-003', projectId: P3, alertRuleId: 'rule-003', severity: 'critical', title: 'Keycloak OIDC endpoint unreachable', description: 'Auth service cannot reach Keycloak discovery endpoint.', firedAt: '2026-04-03T08:16:00.000Z', acknowledgedAt: '2026-04-03T08:17:00.000Z', resolvedAt: '2026-04-03T08:19:00.000Z', incidentId: 'incident-002' },
  { id: 'alert-004', projectId: P2, alertRuleId: 'rule-004', severity: 'medium', title: 'RabbitMQ consumer lag > 4000', description: 'Consumer lag on log-ingestion queue has exceeded warning threshold.', firedAt: '2026-04-03T08:08:00.000Z', acknowledgedAt: null, resolvedAt: '2026-04-03T08:30:00.000Z', incidentId: null },
  { id: 'alert-005', projectId: P1, alertRuleId: null, severity: 'low', title: 'Redis cache eviction pressure', description: 'Over 3000 keys evicted in a 60-second window.', firedAt: '2026-04-03T08:25:00.000Z', acknowledgedAt: null, resolvedAt: null, incidentId: null },
];

// ---------------------------------------------------------------------------
// Incidents (4, mix of statuses)
// ---------------------------------------------------------------------------

export const MOCK_INCIDENTS: Incident[] = [
  { id: 'incident-001', projectId: P1, status: 'open', title: 'API Gateway DB connection pool exhaustion', description: 'Production API is failing ~40% of requests due to pool exhaustion. Correlates with a slow query spike at 08:05.', severity: 'critical', startedAt: '2026-04-03T08:15:00.000Z', acknowledgedAt: null, resolvedAt: null, closedAt: null, assigneeId: '00000000-0000-0000-0001-000000000001', alertIds: ['alert-001', 'alert-002'], aiAnalysisId: null },
  { id: 'incident-002', projectId: P3, status: 'resolved', title: 'Keycloak downtime — OIDC unavailable for 3 min', description: 'The upstream Keycloak instance was unreachable for ~180 seconds. All login attempts during this window failed.', severity: 'critical', startedAt: '2026-04-03T08:16:00.000Z', acknowledgedAt: '2026-04-03T08:17:00.000Z', resolvedAt: '2026-04-03T08:19:00.000Z', closedAt: null, assigneeId: '00000000-0000-0000-0001-000000000002', alertIds: ['alert-003'], aiAnalysisId: 'analysis-001' },
  { id: 'incident-003', projectId: P2, status: 'acknowledged', title: 'Worker service consumer lag spike', description: 'Log ingestion queue lag reached 4200 messages. AI analysis completed — root cause: single slow Elasticsearch bulk index operation.', severity: 'medium', startedAt: '2026-04-03T08:08:00.000Z', acknowledgedAt: '2026-04-03T08:10:00.000Z', resolvedAt: null, closedAt: null, assigneeId: '00000000-0000-0000-0001-000000000003', alertIds: ['alert-004'], aiAnalysisId: 'analysis-002' },
  { id: 'incident-004', projectId: P1, status: 'closed', title: 'SignalR hub broadcast failures (Feb 2026)', description: 'Intermittent SignalR broadcast failures caused by a race condition in the Redis backplane configuration. Fixed in v1.2.3.', severity: 'high', startedAt: '2026-02-14T14:00:00.000Z', acknowledgedAt: '2026-02-14T14:05:00.000Z', resolvedAt: '2026-02-14T16:00:00.000Z', closedAt: '2026-02-14T17:00:00.000Z', assigneeId: '00000000-0000-0000-0001-000000000001', alertIds: [], aiAnalysisId: null },
];
