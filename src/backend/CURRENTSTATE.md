# Backend — Current State

> **Last updated:** 2026-04-27
> **Sprint:** Sprint 3 — implementing the entire backend from scratch
> **Health:** Domain + Application layers complete. Infrastructure has EF Core, ES, Redis, repos, UoW, MassTransit/RabbitMQ pipeline. API layer has controllers, auth, Swagger.

---

## Layer Structure

```
StackSift.Domain/          → ✅ Complete — entities, enums, interfaces, exceptions, value objects
StackSift.Application/     → ✅ Complete — DTOs, 11 commands, 9 queries, validators, ValidationBehavior, DI extension
StackSift.Infrastructure/  → Class1.cs stub only — EMPTY
StackSift.Api/             → Program.cs (weather forecast template) — EMPTY
```

Clean Architecture dependency rule (strictly enforced, no exceptions):
```
Api → Infrastructure → Application → Domain
```

---

## Sprint 3 Cards & Status

| Card | Feature | Status |
|---|---|---|
| BE-1 | Domain layer — entities, value objects, repository interfaces | ✅ Done |
| BE-2 | Application layer — MediatR commands/queries, FluentValidation | ✅ Done |
| BE-3 | EF Core DbContext + initial migrations | 🔲 Not started |
| BE-4 | Infrastructure repositories (PostgreSQL + Elasticsearch) | 🔲 Not started |
| BE-5 | Keycloak JWT auth + RBAC (owner/admin/member/viewer) | 🔲 Not started |
| BE-6 | Redis caching — cache-aside on dashboard stats endpoint | ✅ Done — ICacheService, RedisCacheService, cache-aside in GetDashboardStatsQueryHandler, 2 unit tests, benchmark doc |
| BE-7 | RabbitMQ log ingestion pipeline | ✅ Done — MassTransit 9.1, LogBatchConsumer (ES index + alert eval + incident creation), AlertFiredConsumer, log-ingest/alert-fired fanout exchanges, DLX, 3-retry exponential backoff |
| BE-8 | SignalR AlertHub + Redis backplane | ✅ Done — AlertHub (typed Hub&lt;IAlertHubClient&gt;, [Authorize], cross-tenant guard), Redis backplane, AlertHubService replacing NoOp, LogBatchConsumer broadcasts ReceiveLogEntry, AlertFiredConsumer broadcasts ReceiveAlert, OnMessageReceived for WebSocket JWT, FE: SignalRProvider singleton, useProjectGroupSubscription, accessTokenFactory |
| BE-9 | Hangfire background jobs (log processor + digest email) | ✅ Done — Hangfire 1.8 + PostgreSQL storage (hangfire schema), DigestEmailJob (0 8 * * * UTC), LogRetentionJob (0 2 * * * UTC, plan-based 7/30/90d cutoffs), ImmediateAlertEmailJob (enqueued by AlertFiredConsumer for Critical/High), AppOptions.FrontendBaseUrl, 6 unit tests |
| BE-10 | AI RAG endpoint (pgvector + GPT-4o-mini) | 🔲 Not started |
| BE-11 | Email service (MailKit + retry + dead-letter queue) | ✅ Done — MailKitEmailService (ISmtpClient injectable), Polly v8 ResiliencePipeline (delays configurable via SmtpSettings.RetryDelays), email-dead-letter-queue fanout topology (no consumer — accumulates for replay), 2 HTML embedded templates, 3 unit tests |
| BE-12 | API controllers (versioned, Swagger-documented) | 🔲 Not started |
| BE-13 | API middleware (exception handler, correlation ID, OpenTelemetry) | 🔲 Not started |
| BE-14 | Rate limiting on public endpoints | ✅ Done — AddRateLimiter with two PartitionedRateLimiter policies (LogIngest: 100/60s keyed by X-Api-Key or IP; HealthCheck: 30/60s keyed by IP); OnRejected writes 429 ApiErrorResponse with Retry-After header; UseRouting()+UseRateLimiter() added before UseAuthentication() |
| BE-15 | File upload (MinIO, .log/.txt/.yaml, 50MB limit) | 🔲 Not started |
| BE-16 | SQL optimization + EXPLAIN ANALYZE (3 queries documented) | 🔲 Not started |
| BE-17 | Backend test suite (xUnit + Testcontainers + Moq) | 🔲 Not started |
| BE-18 | AI Log Entry #3 | 🔲 Not started |
| BE-19 | Structured logging (Serilog → Loki → Grafana + correlation IDs) | ✅ Done — Serilog.Sinks.Grafana.Loki 8.*, loki container 2.9.0, Grafana datasource auto-provisioned, docs/loki-setup.md, parallel sink (console preserved) |
| +NEW | .cursorrules for .NET (AI-assisted Swagger enrichment) | 🔲 Not started |

**M3 deadline: Friday, May 8, 2026**

---

## Domain Entity Contract

The frontend `types/domain.ts` is the authoritative contract. The backend JSON serialisation **must** produce these exact camelCase field names and enum string values.

### Entities

```csharp
// Organization
Id, Name, Slug, LogoUrl, CreatedAt, UpdatedAt

// Project
Id, OrganizationId, Name, Slug, Description, Color, CreatedAt, UpdatedAt,
LogSourceCount (computed), ActiveIncidentCount (computed)

// LogSource
Id, ProjectId, Name, Type (LogSourceType), IngestUrl, ApiKey,
IsActive, LastSeenAt, CreatedAt

// LogEntry
Id, ProjectId, LogSourceId, Level (LogLevel), Message, Timestamp,
TraceId, SpanId, ServiceName, HostName, Metadata (jsonb)

// AlertRule
Id, ProjectId, Name, Condition (AlertRuleCondition), Threshold,
WindowMinutes, LogLevel, Pattern, IsActive, CreatedAt, UpdatedAt

// Alert
Id, ProjectId, AlertRuleId, Severity (AlertSeverity), Title, Description,
FiredAt, AcknowledgedAt, ResolvedAt, IncidentId

// Incident
Id, ProjectId, Status (IncidentStatus), Title, Description, Severity,
StartedAt, AcknowledgedAt, ResolvedAt, ClosedAt, AssigneeId,
AlertIds (navigation), AiAnalysisId

// AiAnalysis
Id, IncidentId, Status (AiAnalysisStatus), Summary, RootCause,
SuggestedFixes (string[]), RelevantLogIds (string[]),
ConfidenceScore, CreatedAt, CompletedAt

// User
Id, Email, DisplayName, AvatarUrl, Role (UserRole),
OrganizationId, CreatedAt, LastLoginAt
```

### Enum values (serialised as lowercase strings)

```
LogLevel:            trace | debug | info | warning | error | critical
AlertSeverity:       low | medium | high | critical
IncidentStatus:      open | acknowledged | resolved | closed
UserRole:            owner | admin | member | viewer
LogSourceType:       application | server | database | network | custom
AlertRuleCondition:  threshold | anomaly | pattern | absence
AiAnalysisStatus:    pending | processing | completed | failed
```

### Response envelopes (must match frontend `types/api.ts`)

```csharp
ApiResponse<T>          → { data, success, message }
PaginatedResponse<T>    → { data, total, page, pageSize, hasNextPage, hasPreviousPage }
CursorPaginatedResponse → { data, nextCursor, hasMore }
ApiError (ProblemDetails) → { type, title, status, detail, traceId, errors }
```

---

## Infrastructure Services (Docker Compose)

| Service | Port | Role |
|---|---|---|
| PostgreSQL 16 + pgvector | 5432 | Primary DB + vector embeddings (RAG) |
| Elasticsearch 8.12.0 | 9200 | Log indexing + full-text search |
| Redis | 6379 | Caching + SignalR backplane |
| RabbitMQ 3 | 5672 / 15672 | Async message queue |
| Keycloak | 8080 | Identity provider (JWT issuer) |
| Prometheus | 9090 | Metrics |
| Grafana | 3001 | Dashboards (Loki sink target) |
| Uptime Kuma | 3002 | Uptime monitoring |
| MinIO | 9000 | File storage (log file uploads) |

Start all services: `cd infrastructure/docker && docker compose up -d`

---

## API Spec

- **Base URL:** `http://localhost:5190`
- **Version prefix:** `/api/v1/`
- **Auth:** Bearer JWT issued by Keycloak (`http://localhost:8080/realms/stacksift`)
- **JSON:** camelCase serialisation
- **SignalR hub:** `http://localhost:5190/hubs/stacksift`
  - Method `ReceiveLogEntry` → broadcasts `LogEntry` shape
  - Method `ReceiveAlert` → broadcasts `Alert` shape

### Planned endpoints (to be implemented)

```
GET    /api/v1/health                        (public)
POST   /api/v1/logs/ingest                   (API key auth — rate limited)
GET    /api/v1/projects                      (paginated)
POST   /api/v1/projects
GET    /api/v1/projects/{id}
PUT    /api/v1/projects/{id}
DELETE /api/v1/projects/{id}
GET    /api/v1/projects/{id}/log-sources
POST   /api/v1/projects/{id}/log-sources
GET    /api/v1/logs                          (cursor paginated, filters: projectId/level/search/date/logSourceId)
GET    /api/v1/incidents                     (paginated)
GET    /api/v1/incidents/{id}
PATCH  /api/v1/incidents/{id}/status
POST   /api/v1/incidents/{id}/analyze        (triggers AI RAG)
GET    /api/v1/alerts
GET    /api/v1/alerts/{id}
PATCH  /api/v1/alerts/{id}/acknowledge
POST   /api/v1/alert-rules
PUT    /api/v1/alert-rules/{id}
DELETE /api/v1/alert-rules/{id}
POST   /api/v1/files/upload                  (multipart, MinIO)
GET    /api/v1/dashboard/stats               (Redis cached)
```

---

## Key Conventions

- **C# 13 idioms:** primary constructors, collection expressions, nullable reference types enabled
- **Multi-tenancy:** every entity has `OrganizationId`; repos filter by claim from JWT automatically
- **Soft deletes:** `IsDeleted` flag + EF Core global query filter
- **Audit trails:** `CreatedAt`, `UpdatedAt`, `CreatedBy` auto-set in `SaveChangesAsync` override
- **Every endpoint must have OpenAPI documentation**
- **FluentValidation** on all command/query inputs
- **No business logic in controllers** — controllers call `_mediator.Send()` only
- **No EF Core or Elasticsearch imports in Application layer** — use interfaces only

---

## Application Layer Notes (BE-02)

- **MediatR + FluentValidation** wired via `DependencyInjection.AddApplication()`
- **ValidationBehavior** runs all validators before any handler; throws `ValidationException` on failure
- **`IMessagePublisher`** abstraction in `Application/Interfaces/` — implemented by `MassTransitMessagePublisher` (Infrastructure/Messaging/)
- **`LogBatchMessage` / `AlertFiredMessage`** in `Application/Messages/` — consumed by `LogBatchConsumer` / `AlertFiredConsumer` in `Infrastructure/Messaging/Consumers/`
- **`IAlertHubService`** in `Application/Interfaces/` — stub `NoOpAlertHubService` until BE-08
- **Entity→DTO mapping** via internal `EntityMappingExtensions` (static extension methods in `Application/Mapping/`)
- **`IngestLogBatchCommand`** validates batch ≤1000 entries, publishes `LogBatchMessage`, returns 202 (no direct DB write)
- **`GetDashboardStatsQuery`** uses Redis cache-aside (60s TTL, key `dashboard:stats:{orgId}`). `LogBatchConsumer` invalidates this key after creating a new Alert or Incident.
- **`IEmailService`** implemented by `MailKitEmailService`. Inject `SmtpSettings` with `RetryDelays = [Zero, Zero, Zero]` in tests to skip actual delays. BE-09 jobs call `IEmailService.SendAsync` directly — do not call `SmtpClient` directly.
- **`email-dead-letter-queue`** — fanout exchange `email-dead-letter`, no consumer registered. Messages published by `MailKitEmailService` on final retry exhaustion accumulate here for manual replay.
- **`AlertRule.Severity`** added (migration `AddSeverityToAlertRule`) — required for alert creation in consumer
- **MassTransit topology:** log-ingest (fanout) → log-ingest-queue, alert-fired (fanout) → alert-fired-queue, DLX: log-ingest-dlx. Retry: 5s/15s/30s. Config in `appsettings.json RabbitMq` section.
- **Consumers use `AppDbContext` directly** (not `IUnitOfWork`) — avoids HttpContext-scoped org filtering in background consumer context
- Handlers that scope by org use `ICurrentUserService.OrganizationId` — repos will enforce it in BE-04

---

## Test Project

`StackSift.Tests` — xUnit + Moq, added to `StackSift.slnx`. Run with `dotnet test StackSift.Tests`.

---

## Required NuGet Packages (not yet installed)

```
MediatR
FluentValidation.AspNetCore
AutoMapper (or Mapperly)
Microsoft.EntityFrameworkCore + Npgsql.EntityFrameworkCore.PostgreSQL
Elastic.Clients.Elasticsearch
~~StackExchange.Redis~~ ✅ installed
~~MassTransit.RabbitMQ~~ ✅ installed (8.3.7)
~~MailKit~~ ✅ installed (4.16.0)
~~Polly~~ ✅ installed (8.6.6)
Hangfire + Hangfire.PostgreSql
Microsoft.AspNetCore.SignalR
Keycloak.AuthServices.Authentication + Keycloak.AuthServices.Authorization
Serilog.AspNetCore + Serilog.Sinks.Grafana.Loki
OpenTelemetry.Extensions.Hosting + OpenTelemetry.Instrumentation.AspNetCore
MailKit
Minio
OpenAI (for embeddings + GPT-4o-mini)
Pgvector.EntityFrameworkCore
Swashbuckle.AspNetCore
xUnit + Microsoft.AspNetCore.Mvc.Testing + Testcontainers.PostgreSql + Moq + coverlet.collector
```
