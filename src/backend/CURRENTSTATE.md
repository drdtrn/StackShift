# Backend — Current State

> **Last updated:** 2026-05-25 (ORG-1)
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
| BE-10 | AI RAG endpoint (pgvector + GPT-4o-mini) | ✅ Done — RunAiAnalysisJob (Hangfire, idempotent, 5-retry), OpenAiVectorSearchService (text-embedding-3-small, 1536-d), OpenAiAnalysisService (gpt-4o-mini JSON mode), AiAnalysesController GET, Embedding vector(1536) + HNSW cosine index, IAiAnalysisJobRunner (Clean Arch), IChatCompleter/IEmbedder SDK wrappers, 20/20 unit tests |
| BE-11 | Email service (MailKit + retry + dead-letter queue) | ✅ Done — MailKitEmailService (ISmtpClient injectable), Polly v8 ResiliencePipeline (delays configurable via SmtpSettings.RetryDelays), email-dead-letter-queue fanout topology (no consumer — accumulates for replay), 2 HTML embedded templates, 3 unit tests |
| BE-12 | API controllers (versioned, Swagger-documented) | 🔲 Not started |
| BE-13 | API middleware (exception handler, correlation ID, OpenTelemetry) | 🔲 Not started |
| BE-14 | Rate limiting on public endpoints | ✅ Done — AddRateLimiter with two PartitionedRateLimiter policies (LogIngest: 100/60s keyed by X-Api-Key or IP; HealthCheck: 30/60s keyed by IP); OnRejected writes 429 ApiErrorResponse with Retry-After header; UseRouting()+UseRateLimiter() added before UseAuthentication() |
| BE-15 | File upload (MinIO, .log/.txt/.yaml, 50MB limit) | ✅ Done — IFileStorageService + FileUploadResult (Domain), S3FileStorageService + S3StorageOptions (Infrastructure), UploadLogFileCommand + FileUploadDto (Application), FilesController.Upload streaming (201 + Location), FileUpload rate limit 20/min per org, MinIO + minio-init in docker-compose, AWSSDK.S3 3.7.* |
| BE-16 | SQL optimization + EXPLAIN ANALYZE (3 queries documented) | ✅ Done — performance indexes on Projects/Incidents/LogEntries, N+1 eliminated on projects list query (subquery aggregation), EXPLAIN ANALYZE for 3 queries in docs/sql-optimization.md |
| BE-17 | Backend test suite (xUnit + Testcontainers + Moq) | ✅ Done — InMemory removed; 3 DB-touching unit tests migrated to PostgresContainerFixture (pgvector:pg16 + Respawn); WebApplicationFactory + Testcontainers Keycloak; KeycloakTestRealmSeeder seeds realm+client+mappers+2 users; KeycloakTokenClient caches real JWTs; AuthIntegrationTests (401/200/403/404/health), ProjectsControllerTests (full CRUD + duplicate-slug 409), IncidentsControllerTests (status filter, transitions, cross-tenant 404); docs/test-coverage.md; SlugExistsInOrgAsync added to fix 409 conflict; invalid transition guard added for 400 |
| FS-MT | Multi-tenancy verification | ✅ Done — systematic cross-org 404 tests for all 8 controllers (Projects, LogSources, AlertRules, Alerts, Incidents, AiAnalyses, Files, LogEntries ingest); orgId-in-body ignored tests for Projects + AlertRules; Logs read isolation verified by code audit (ES not in testcontainers); Files key-prefix guard verified by code audit; docs/multi-tenancy-verification.md |
| BE-18 | AI Log Entry #3 | 🔲 Not started |
| BE-19 | Structured logging (Serilog → Loki → Grafana + correlation IDs) | ✅ Done — Serilog.Sinks.Grafana.Loki 8.*, loki container 2.9.0, Grafana datasource auto-provisioned, docs/loki-setup.md, parallel sink (console preserved) |
| BE-20 | .cursorrules for .NET (AI-assisted Swagger enrichment) | ✅ Done — `/.cursorrules` rewritten (12 sections, ~204 lines, project-specific .NET rules), 4 request-body records documented, `UploadLogFileForm` record introduced (fixes Swashbuckle multipart blocker so `swagger.json` generates), 9 controllers enriched with `<remarks>` + `<response>` blocks, 7 controllers converted to primary constructors, `BaseApiController`/`HealthController`/3 middleware classes/`ApiErrorResponse` documented, CS1591 unsuppressed in `StackSift.Api.csproj`, `docs/swagger-enrichment.md` (95 lines, honest reflection on AI hallucination + Swashbuckle blocker), `docs/ai-log.md` row appended |
| NUF-1 | Keycloak admin client + service account | ✅ Done — `stacksift-backend-admin` confidential client added to realm JSON (service accounts enabled, `manage-users`/`view-users`/`query-users` from `realm-management`), `directAccessGrantsEnabled` flipped on `stacksift-frontend` for ROPC, `IKeycloakAdminClient` interface in Application layer (`CreateUserAsync`/`SetUserAttributesAsync`/`DeleteUserAsync`/`FindUserByEmailAsync`), `KeycloakAdminClient` implementation in Infrastructure (`SemaphoreSlim`-coalesced service-account token cache, GET-mutate-PUT for SetAttributes, 409 → ConflictException, 404 → NotFoundException, `TimeProvider` injected for unit tests), `services.AddHttpClient<IKeycloakAdminClient, KeycloakAdminClient>()` wiring, new `Keycloak:Admin` section in `appsettings.json`, 12 unit tests + 5 integration tests (Testcontainers Keycloak, full create → ROPC-login → JWT-claims round-trip) — 127/127 suite green |
| NUF-2 | Backend registration endpoint | ✅ Done — new `Invitation` domain entity + `IInvitationRepository` (`FindPendingByEmailAsync`/`FindByTokenAsync`, no org-scoping by design); `User.InvitedByUserId` self-FK; single migration `AddInvitationsAndInvitedBy` (partial unique index on `Email WHERE AcceptedAt IS NULL AND IsDeleted=false`); `RegisterUserCommand` + handler — invitation wins over the form's `isOwner` flag, DB-failure compensation deletes the orphaned Keycloak user with `CancellationToken.None` so it survives caller cancellation; `RegisterUserCommandValidator` (email/12-char password with upper+lower+digit/display name); anonymous `AuthController.Register` at `POST /api/v1/auth/register` with `[EnableRateLimiting("Register")]` (5 / IP / 10 min, fixed-window); 20 unit tests + 4 integration tests (Testcontainers — covers happy path, duplicate→409, invitation auto-attach, rate-limit 429) — 151/151 suite green |
| NUF-5 | Members management for owners | ✅ Done — `IUserRepository.FindByEmailAsync` + `CountOwnersAsync`; `IInvitationRepository.ListPendingByOrgAsync`; `TokenGenerator.UrlSafe(24)` for invitation tokens; **5 new commands** (`AddOrInviteMember` unified attach-or-invite flow, `UpdateMemberRole`, `RemoveMember`, `AcceptInvitation`) all sharing the DB→Keycloak write-source pattern with rollback on KC failure; **shared last-owner guard** in Update + Remove (cannot demote/remove the last owner); `GetMembersQuery` returns the team with inviter-displayName join; `MembersController` at `/api/v1/organizations/{orgId}/members` — `ViewerOrAbove` for List, `OwnerOnly` for the three mutations (201 attached / 202 invited / 409 last-owner / 404 cross-tenant); `AuthController.AcceptInvitation` at `POST /api/v1/auth/accept-invitation` (anonymous, rate-limited under the shared Register envelope); new `IMemberEmailComposer` (Application interface) + `MemberEmailComposer` impl (Infrastructure) with two new embedded HTML templates (`MemberAdded.html`, `Invitation.html`); 23 unit tests + 10 integration tests (Testcontainers — covers list-policy, owner-only enforcement, cross-tenant 404, last-owner 409, AddOrInvite both paths, the negative `/unassigned` route check) — **184/184 backend suite green** |
| ORG-1 | Real organisation-creation endpoint | ✅ Done — replaces the FS-era mock BFF that minted unsigned JWTs. New `OrganizationDto` + mapping; `IOrganizationRepository.SlugExistsAsync` (pre-check for clean 409) + `HardDeleteAsync` (raw `ExecuteDeleteAsync` so compensation releases the unique-slug index slot); `CreateOrganizationCommand` handler — claim+row check that the caller has no org, slug derived from name (matches the validator regex), force-promotion to Owner, insert + `SetUserAttributesAsync` with full rollback (DB row + hard-delete org) on Keycloak failure; `OrganizationsController` at `POST /api/v1/organizations` — `[Authorize]` without a role policy (the no-org check is the gate); 11 unit tests + 5 integration tests (ownerless user seeded in `KeycloakTestRealmSeeder.OwnerlessEmail`); **200/200 backend suite green**. Also includes a NUF-1 realm-import fix prerequisite (service-account user UUID was 42 chars and crashed import; client `fullScopeAllowed: false` dropped role claims from the access token). |

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
| MinIO | 9000 / 9001 | File storage (log file uploads) — API 9000, Console UI 9001 |

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

## BE-15 Notes & Gotchas

- **Streaming upload:** `S3FileStorageService` passes `IFormFile.OpenReadStream()` directly into `TransferUtilityUploadRequest.InputStream` — no `byte[]` or `MemoryStream` buffering.
- **MinIO path-style:** `AmazonS3Config.ForcePathStyle = true` is mandatory; without it the SDK appends the bucket as a subdomain and fails against MinIO.
- **Presigned URL rewriting:** When API runs in Docker (`Endpoint = http://minio:9000`) set `PublicEndpoint = http://localhost:9000` so the URL returned to the browser is accessible. The service does a string replacement.
- **Env vars for MinIO credentials:** Set `Storage__S3__AccessKey` / `Storage__S3__SecretKey` via environment or docker-compose. `appsettings.Development.json` has hardcoded `minioadmin`/`minioadmin_secret` dev defaults.
- **minio-init container:** Runs once after MinIO healthcheck passes; creates the `stacksift-uploads` bucket. Uses `minio/mc:latest`.
- **Application FrameworkReference:** Added `<FrameworkReference Include="Microsoft.AspNetCore.App" />` to `StackSift.Application.csproj` so `IFormFile` is available in the command without adding an extra package.
- **global.json:** Pinned at `10.0.104` with `rollForward: disable` — do not change; teammates have this SDK. If your local machine only has a later SDK, temporarily edit global.json locally but do NOT commit the change.

---

## NUF-1 Notes & Gotchas

- **Keycloak admin client is the only path to the KC admin REST API** — `IKeycloakAdminClient` in `Application/Interfaces` is the seam; controllers and handlers must never call `/admin/realms/.../users` directly. NUF-2 (registration) and NUF-5 (members) consume this interface.
- **`PUT /admin/realms/{realm}/users/{id}` replaces the full representation** — sending only `{ "attributes": { … } }` blanks `firstName`/`email`/credentials. `SetUserAttributesAsync` uses GET-mutate-PUT for that reason. A unit test pins the PUT body shape so the bug can't re-emerge.
- **Service-account token coalescing** — `KeycloakAdminClient` holds a `SemaphoreSlim` so 1000 concurrent `CreateUserAsync` calls produce a single `client_credentials` round-trip (verified in `TokenCache_CoalescesConcurrentCalls`). TTL = 60 s minus a 10 s safety margin; `TimeProvider` is injected so the unit test can advance the clock past expiry.
- **Realm reimport** — JSON edits to `infrastructure/keycloak/stacksift-realm.json` only take effect after `docker compose down -v && docker compose up -d`. Document referenced in `docs/auth-flow.md` §5 and §7.1.
- **Admin client secret** — the realm JSON ships with the literal `REPLACE_AT_RUNTIME` placeholder. Real value is auto-generated by Keycloak on first import; copy it from the admin UI into `dotnet user-secrets set "Keycloak:Admin:AdminClientSecret" "..."`.

### Env vars (NUF-1)

| Variable | Where it's read | Notes |
|---|---|---|
| `Keycloak__Admin__RealmUrl` | `KeycloakAdminOptions.RealmUrl` | Default `http://localhost:8080/realms/stacksift` (`appsettings.json`). |
| `Keycloak__Admin__AdminBaseUrl` | `KeycloakAdminOptions.AdminBaseUrl` | Default `http://localhost:8080/admin/realms/stacksift`. **No trailing slash** — string-concat in `KeycloakAdminClient` relies on it. |
| `Keycloak__Admin__AdminClientId` | `KeycloakAdminOptions.AdminClientId` | Default `stacksift-backend-admin`. |
| `Keycloak__Admin__AdminClientSecret` | `KeycloakAdminOptions.AdminClientSecret` | Sourced from `dotnet user-secrets` locally; from the secret manager (or compose env) in prod. Placeholder lives in `infrastructure/docker/.env.example`. |

---

## NUF-2 Notes & Gotchas

- **Email is the natural key.** All registration paths lower-case + trim before any comparison or write. The DB-level unique index on `Users.Email` is case-sensitive; matching the `Invitation` lookup against the same normalised form is what keeps the join consistent.
- **Invitations win over the registration form.** A user who submits `isOwner: true` but matches a pending, non-expired `Invitation` is created with the *invitation's* role + org; the form value is discarded. Documented in §15 Q9 of the parent New-User-Flow plan; verified by `PendingInvitation_OverridesFormRole`.
- **`User.Id == KeycloakUserId` is deliberate.** We reuse Keycloak's generated UUID as the `Users.Id` PK — saves a separate `keycloak_user_id` column and makes downstream joins trivial. EF Core's `Users.Id` has `DefaultValueSql("gen_random_uuid()")` but the registration handler always sets `Id` explicitly, so the default never fires for registered users.
- **DB-failure compensation deletes the orphan Keycloak user.** The compensating `DeleteUserAsync` runs with `CancellationToken.None` because the caller's `ct` may already be cancelled (e.g. on app shutdown) and we'd rather log a delete failure than leave a permanent orphan. Compensation failures are still logged at `Error` level.
- **Pending-invitation lookup repo uses `LOWER(email)`** on both sides — `InvitationRepository.FindPendingByEmailAsync` normalises the argument; the column is written normalised by the same handler. The partial unique index `IX_Invitations_Email` (filter `"AcceptedAt" IS NULL AND "IsDeleted" = false`) makes re-invitation after acceptance work without a soft-delete dance.
- **No password-policy mirroring.** The `RegisterUserCommandValidator` enforces the minimum bar (12 chars + upper + lower + digit); Keycloak's password policy is the second gate. Don't duplicate Keycloak's policy in the validator — let Keycloak surface its own rejection and surface that as 400.
- **Rate-limit test ordering.** The `Register` policy partitions by `RemoteIpAddress`. Within an xUnit collection sharing one `StackSiftWebApplicationFactory`, exhausting the IP partition in one test would cascade into 429s for siblings. `RegisterEndpointTests` applies `AlphabeticalTestCaseOrderer` and prefixes the rate-limit test with `Z_` so it runs last; any new register-touching test should keep that contract.

---

## NUF-5 Notes & Gotchas

- **`IMemberEmailComposer` keeps Application clean of template loading.** The Application layer command needs an `EmailMessage` to call `IEmailService.SendAsync`, but HTML templates + `AppOptions.FrontendBaseUrl` are Infrastructure concerns. The interface (Application) takes raw inputs (org name, role, token, expiry) and returns a fully-rendered `EmailMessage`; the impl (Infrastructure) loads embedded HTML via `MailKitEmailService.LoadTemplate`, URL-encodes the token, escapes interpolated text.
- **`HttpContextCurrentUserService.UserId` fallback.** The default JWT bearer handler maps `sub` → `ClaimTypes.NameIdentifier` and `email` → `ClaimTypes.Email` *before* claims hit the principal — `FindFirstValue("sub")` returns null in that case. The service now reads both names so handlers like `AddOrInviteMemberCommandHandler` (the first consumer of `UserId` for a *query*, not just metadata) work correctly. Pre-NUF-5 consumers used `UserId` for Stripe metadata only and silently got `Guid.Empty` — fix made retroactively safe.
- **`MembersController` uses `ViewerOrAbove` for `GET`, `OwnerOnly` for the three mutations.** The named policy `MemberOrAbove` already exists but excludes `viewer`; per plan §2.5 every team member (viewer included) sees the team list, so the list endpoint uses `ViewerOrAbove`.
- **Last-owner guard is shared between `UpdateMemberRoleCommand` and `RemoveMemberCommand`.** Both call `IUserRepository.CountOwnersAsync(orgId)` before mutating. Canonical message: `"Cannot remove or demote the last owner of an organisation."` — the frontend tests against this string.
- **Removed users keep their account.** `RemoveMemberCommand` clears `OrganizationId`, sets `Role = Viewer`, and clears `InvitedByUserId`, then mirrors the same on Keycloak attrs — but does **not** call `DeleteUserAsync`. The user lands back on `/waiting` on next sign-in. GDPR full-delete is a separate post-NUF card.
- **Invitation upsert avoids partial-unique-index conflicts.** When the same email is re-invited while a pending invitation already exists, `AddOrInviteMemberHandler` *updates* the existing row (new token, new expiry, possibly new role/org) rather than inserting. The NUF-2 partial unique index `IX_Invitations_Email WHERE AcceptedAt IS NULL AND IsDeleted = false` would otherwise reject the second insert.
- **`Z_AcceptInvitation_UnknownToken_Returns409` is *not* in `MembersControllerTests`.** It would share the `Register` rate-limit envelope with `RegisterEndpointTests` and intermittently surface 429 instead of 409. Unit-level coverage in `AcceptInvitationCommandHandlerTests.UnknownToken_Returns409` is the trustworthy assertion.

---

## ORG-1 Notes & Gotchas

- **`Organizations.Slug` unique index doesn't filter on `IsDeleted = false`.** Soft-delete would leave the slug occupied forever. The create-org compensation path therefore uses `HardDeleteAsync` — a raw `ExecuteDeleteAsync` that bypasses the `AppDbContext.SaveChangesAsync` soft-delete interceptor. **Do not use `HardDeleteAsync` outside this seam**; normal org deletion still goes through the soft-delete `DeleteAsync`.
- **Owner promotion is silent and force-applied** on org creation. Any authenticated user without an org becomes Owner of the new one regardless of their pre-existing role. Logged at Information level when the previous role wasn't Owner; doesn't fire via the UI but the handler is the source of truth.
- **The handler checks for "already has an org" twice** — once on `currentUser.OrganizationId != Guid.Empty` (from the JWT claim) and once on the freshly-loaded `user.OrganizationId is not null` (from the DB row). Defends against cookie/DB drift; the second check is what catches a stale JWT after a re-attach.
- **NUF-1 realm-import bugs were prerequisites** for this card to work at all (real registration to real Keycloak). The fix lives in the same branch: `service-account-stacksift-backend-admin` user UUID lengthened beyond 36 chars (Keycloak's `USER_ENTITY.ID` is `varchar(36)`); `stacksift-backend-admin` client `fullScopeAllowed: true` (was false, which dropped the realm-management role mappings from the issued access token).
- **The mock onboarding BFF is dead.** `src/frontend/src/app/api/onboarding/create-org/route.ts` no longer generates unsigned JWTs; it proxies to `POST /api/v1/organizations` and runs a Keycloak `refresh_token` grant to rotate the cookie. `replaceSessionCookie` in `src/frontend/src/app/lib/auth/session.ts` was the helper that minted those unsigned JWTs and is removed along with its test.

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
