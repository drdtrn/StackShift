# Multi-Tenancy Verification

> **Sprint:** Sprint 5 — FS-MT  
> **Coverage:** M5.10  
> **Guarantee:** Every cross-org read and write returns **404** (not 403). 403 leaks resource existence; masking is the requirement.

---

## How org isolation works

Every entity carries an `OrganizationId` column. The token's `organization_id` claim is
read by `KeycloakCurrentUserService` and exposed via `ICurrentUserService.OrganizationId`.
Command and query handlers always scope DB queries to the caller's `OrganizationId` — the
value is **never read from the request body or URL path**.

---

## Test matrix

| Controller | GET list isolated | GET by ID cross-org | Mutate cross-org | POST body orgId ignored | Test file |
|---|---|---|---|---|---|
| **Projects** | ✅ `GetProjects_WrongOrg_ListIsIsolated` | ✅ `GetProject_WrongOrg_Returns404` | ✅ `UpdateProject_WrongOrg_Returns404` / `DeleteProject_WrongOrg_Returns404` | ✅ `CreateProject_OrgIdInBodyIsIgnored_ProjectBelongsToCallerOrg` | `ProjectsControllerCrossOrgTests` |
| **LogSources** (nested under Projects) | — | ✅ `GetLogSources_WrongOrg_Returns404` | ✅ `CreateLogSource_WrongOrg_Returns404` | — (orgId derived from parent project) | `ProjectsControllerCrossOrgTests` |
| **AlertRules** | ✅ `GetAlertRules_WrongOrgProjectId_ReturnsEmpty` | — (list only) | ✅ `UpdateAlertRule_WrongOrg_Returns404` / `DeleteAlertRule_WrongOrg_Returns404` | ✅ `CreateAlertRule_OrgIdInBodyIsIgnored_RuleBelongsToCallerOrg` | `AlertRulesControllerTests` |
| **Alerts** | ✅ `GetAlerts_WrongOrg_ListIsIsolated` | ✅ `GetAlert_WrongOrg_Returns404` | ✅ `AcknowledgeAlert_WrongOrg_Returns404` | — (no POST body with orgId) | `AlertsControllerTests` |
| **Incidents** | — (see note) | ✅ `GetIncident_WrongOrg_Returns404` | ✅ `PatchStatus_WrongOrg_Returns404` / `TriggerAnalysis_WrongOrg_Returns404` | — (no public create endpoint) | `IncidentsControllerTests` |
| **AiAnalyses** | — (no list endpoint) | ✅ `GetAiAnalysis_WrongOrg_Returns404` | — (read-only controller) | — | `AiAnalysesControllerTests` |
| **Files** | — (no list endpoint) | — | ✅ `UploadFile_WrongOrg_Returns404` | ✅ key-prefix (code audit, see below) | `FilesControllerTests` |
| **Logs (ingest)** | — | — | ✅ `IngestLogs_WrongOrgLogSource_Returns404` | — (orgId not in body) | `LogEntriesControllerTests` |
| **Logs (read)** | ✅ code audit (see below) | — | — | — | — |
| **Members** (NUF-5) | ✅ `List_AsViewer_OfOtherOrg_Returns404` | — (no GET by id) | ✅ `AddOrInvite_CrossOrg_Returns404` (owner of A → B → 404); update/remove inherit via the route `orgId` guard in the handler | ✅ orgId comes from the route, never the body | `MembersControllerTests` |
| **AcceptInvitation** | — | — | n/a — anonymous; org affiliation comes from the invitation token, not the caller | — | unit-level `AcceptInvitationCommandHandlerTests` |

---

## Code-audit items (not testable without additional testcontainers)

### Logs read — Elasticsearch isolation

`GET /api/v1/logs` queries Elasticsearch, which is not provisioned in the current
Testcontainers suite (Postgres + Keycloak + Redis only).

**Audit result:** `GetLogEntriesQueryHandler` passes `currentUser.OrganizationId` as a
required filter on every ES query. There is no path in the handler that skips the org
filter. Integration test requires an Elasticsearch testcontainer; tracked as a follow-up.

### Files — presigned URL key prefix

`S3FileStorageService.UploadAsync` builds the object key as:

```
{organizationId}/{projectId}/{yyyy/MM/dd}/{guid}_{originalFileName}
```

The `organizationId` segment comes from `ICurrentUserService.OrganizationId` via the
metadata dictionary passed by `UploadLogFileCommand`, **not** from any request body field.
The `FilesController.Upload` form model (`UploadLogFileForm`) exposes only `file` and
`projectId` — there is no `organizationId` field to inject.

Cross-org access is blocked before the storage call: `UploadLogFileCommand` fetches the
project and throws `NotFoundException` if `project.OrganizationId != currentUser.OrganizationId`.

---

## Property: 404 not 403

All cross-org responses in the test matrix return **404 Not Found**, not 403 Forbidden.
This masks the existence of the resource from a cross-tenant caller, preventing enumeration
attacks. The pattern is enforced by throwing `NotFoundException` in every command and query
handler when the org check fails:

```csharp
if (resource.OrganizationId != currentUser.OrganizationId)
    throw new NotFoundException(nameof(Resource), id);
```

The global exception-handling middleware maps `NotFoundException` to HTTP 404.

---

## Property: orgId never read from request body

All write endpoints (`POST`, `PUT`, `PATCH`) derive `OrganizationId` from
`ICurrentUserService.OrganizationId` (i.e. the JWT `organization_id` claim).
None of the command records expose an `organizationId` property that model-binding
could populate from the request body. Extra JSON fields are silently ignored by the
.NET model binder. Integration tests confirm that posting `organizationId: orgBId` in
a body produces a resource with `organizationId: orgAId` (the caller's org).

---

## Running the tests

```bash
cd src/backend
dotnet test StackSift.Tests --filter "FullyQualifiedName~Integration" --logger "console;verbosity=detailed"
```

> Containers start once per test run (Testcontainers xUnit collection fixture).
> Cold-start time is approximately 30–60 seconds; subsequent tests use Respawn (~50 ms reset).
