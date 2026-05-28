# 02 — Log Source & API Key UX

> **Goal:** Make it possible for a real customer to discover their API key, regenerate it, delete a log source, and copy a working integration recipe — entirely from the dashboard, without SSHing into the database.
> **Why this matters:** Today a customer can sign up, create a project, and create a log source — but the dashboard never renders the API key. Without that key they cannot send a single log entry. This single gap turns a working ingestion pipeline into a dead-end product. Research-05-2 §A.3 calls this "a hard blocker for any send-logs workflow that isn't 'let me SSH into the DB and SELECT it.'"
> **Effort estimate:** 4–5 working days.
> **Depends on:** `01-contract-fixes` (Zod/contract drift items merged, so the LogSource Zod schema is the canonical truth).
> **Blocks:** `03-ingestion-sdks` (the integration recipe page in §2.6 of this plan is the in-app landing surface where SDK snippets from Plan 03 are rendered), `04-containerization` (no point shipping a Docker image whose dashboard cannot onboard a stranger), `05-auth-hardening` (the audit-log table from §2.8 is reused for sign-in/verification events).

---

## Implementation phases & todo list

The 11 sub-tasks below (2.1–2.11) do not execute in numeric order. The plan body locks several non-obvious calls inline (HMAC-SHA-256 not BCrypt, hard-cut regenerate not grace-period, soft-delete with `IsActive=false` first); a handful of *fresh* decisions still need to be made before code touches the keyboard. The rest is mechanical layering: foundation → schema → application → controllers → frontend hooks → frontend pages → wizard rewire → verification. Do the phases in order; within a phase, tasks are independent and parallelisable.

### Phase 0 — Decisions (no code yet, ~30 min)

Four open calls. Lock each before writing code; record in the PR description.

- [x] **Decision 0.1 — Pepper storage in production.** Local dev: `dotnet user-secrets` (the established pattern for Stripe and OpenAI keys per `docs/payments.md`). Production: ASP.NET Core env var (`LogSources__KeyPepperBase64`) bound through the same mechanism `OpenAi__ApiKey` already uses. Long-term destination is External Secrets Operator per Plan 08 §9 — keep the *interface* (env var) the same, swap only the *source*. Recommendation: **env var for v1**, no change needed when Plan 08 ships.
- [x] **Decision 0.2 — Migration strategy: single-cut or expand/contract?** The plan body §2.1 implies a single migration that adds the new columns, backfills, and drops `ApiKey`. Plan 09 §9.2's expand/contract policy says to split across two releases for production safety. **For Plan 02 specifically, single-cut is correct** — there are no paying customers yet, the codebase has no rows that need to survive a window where ingestion is partially broken, and the test fixtures are reset per test. Defer expand/contract discipline to the first post-launch migration that has live customer keys (Plan 09 §9.3 establishes the pattern there).
- [x] **Decision 0.3 — §2.11 (Settings → API page) in v1 or defer?** The org-level overview page is ~2 hours of work and removes the "drill into each project to find a key" annoyance. Recommendation: **ship in v1** — small enough to fit, large enough impact on the support-question rate to be worth it.
- [x] **Decision 0.4 — Snippet content owner.** §2.6's `SerilogSnippet`/`WinstonSnippet` components will render the same content Plan 03's SDK README publishes. Two paths: (a) the components hard-code the snippet text now and Plan 03 updates them when the SDK ships; (b) the components import from a shared `snippets/` package built in Plan 03 first. Recommendation: **(a) — hard-code now**, redirect from a comment to the Plan 03 SDK once published. Avoids a hard dependency cycle on Plan 03.

### Phase 1 — Hasher & configuration (~2 hours, blocks Phases 2–4)

The hasher is the smallest unit and everything depends on it. Build it first; one unit test proves it works before any handler ever calls it.

- [x] **1.A — `IApiKeyHasher` interface** in `src/backend/StackSift.Application/Interfaces/IApiKeyHasher.cs` per the plan body §2.1 (Generate / Verify / Hash).
- [x] **1.B — `HmacApiKeyHasher` implementation** in `src/backend/StackSift.Infrastructure/Identity/HmacApiKeyHasher.cs`. HMAC-SHA-256 with the pepper, "ss_"-prefixed 35-char keys, 64-char hex output. Includes `CryptographicOperations.FixedTimeEquals` for `Verify` to defeat timing side-channels.
- [x] **1.C — `LogSourceOptions` config record** binding `LogSources:KeyPepperBase64`. Add a startup check that throws on missing / short pepper (< 32 bytes after base64-decode) — fail the API at boot rather than at first request.
- [x] **1.D — DI registration** for `IApiKeyHasher` (singleton) and `LogSourceOptions` (Configure pattern) in `Infrastructure/Extensions/ServiceCollectionExtensions.cs`.
- [x] **1.E — Local pepper bootstrap.** Add a 32-byte random pepper to `dotnet user-secrets` and document the generation command (`openssl rand -base64 32`) in `docs/secrets.md`. Do **not** commit a real pepper; include a placeholder in `appsettings.Development.json.example` if one exists.
- [x] **1.F — Unit test** `HmacApiKeyHasherTests.cs`: (1) `Generate` returns "ss_"-prefixed 35-char key; (2) `Hash(x) == Hash(x)` is deterministic; (3) `Verify` returns true for the original and false for a one-char tampered candidate; (4) `Verify` is constant-time (loose sanity check, not a full timing attack proof).

### Phase 2 — Schema migration (~3 hours, blocks Phase 4)

Per Decision 0.2: single-cut migration that adds columns, backfills, and drops `ApiKey`. Solo dev, no live data — safe.

- [ ] **2.A — `LogSource` entity update** in `src/backend/StackSift.Domain/Entities/LogSource.cs`. Add `KeyHash`, `KeyPrefix`, `KeyLastUsedAt`, `KeyRotatedAt`. Remove `ApiKey`. Remove the dead `IngestUrl` field's free-text usage and pin it server-side to `"/api/v1/logs/ingest"` (Plan 01 §4.A already cleared the frontend writers — the field becomes purely informational).
- [ ] **2.B — `LogSourceConfiguration` EF update** in `src/backend/StackSift.Infrastructure/Persistence/Configurations/LogSourceConfiguration.cs`. Required + max-length on the two new string columns, unique index on `KeyHash`, non-unique index on `KeyPrefix` for the lookup path.
- [ ] **2.C — EF migration `AddLogSourceKeyHashing`** generated via `dotnet ef migrations add AddLogSourceKeyHashing -p StackSift.Infrastructure -s StackSift.Api`. Migration body:
  - Up: add new columns; raw-SQL backfill computes `KeyPrefix = SUBSTRING(api_key, 1, 8)`, `KeyHash = encode(hmac(api_key, pepper, 'sha256'), 'hex')` via the `pgcrypto` extension (already enabled per `init-stacksift.sh`); make columns NOT NULL; drop `ApiKey`.
  - Down: re-add `ApiKey` as nullable, leave it empty (down-migration on a dropped secret column is fundamentally lossy — accept it).
- [ ] **2.D — Migration smoke test.** Apply against the local dev DB (or a Testcontainers fixture), verify no row has a NULL hash or prefix after the migration.

### Phase 3 — Audit log infrastructure (~3 hours, parallelisable with Phase 2)

§2.8 of the plan body. The audit log is also reused by Plans 05 (auth events) and 09 (GDPR erasure events), so the schema is wider than this plan alone needs — but the columns it doesn't need yet are nullable.

- [ ] **3.A — `AuditLogEntry` entity** in `src/backend/StackSift.Domain/Entities/AuditLogEntry.cs` per the plan body shape.
- [ ] **3.B — `AuditEvent` enum** in `src/backend/StackSift.Domain/Enums/AuditEvent.cs`. Includes the LogSource events plus the future-Plan-05/09 stubs (`MemberInvited`, `PlanUpgraded`, etc. — defined now so the enum is stable).
- [ ] **3.C — `IAuditLog` interface** in `src/backend/StackSift.Application/Interfaces/IAuditLog.cs`.
- [ ] **3.D — `PostgresAuditLog` implementation** in `src/backend/StackSift.Infrastructure/Audit/PostgresAuditLog.cs`. Synchronous single-row insert into `audit_log_entries`. The handler is one-shot, no retries — if the audit fails, the operation fails (we never want a key regenerated whose audit row is missing).
- [ ] **3.E — EF configuration + migration `AddAuditLogEntries`**. Indexes on `(OrganizationId, OccurredAt)` for the future browse-UI, and on `(Event, OccurredAt)` for compliance queries.
- [ ] **3.F — DI registration** for `IAuditLog` (scoped — needs `ICurrentUserService` to enrich rows with acting user).

### Phase 4 — Backend application + controller layer (~8 hours)

Six handlers and two controllers, ordered by dependency. Internal to a phase the tasks are independent — two engineers can split alongside the obvious commands/queries boundary.

- [ ] **4.A — `LogSourceDto` shape change.** Drop `ApiKey` from the existing record. Add `KeyPrefix`, `KeyLastUsedAt`, `KeyRotatedAt`. Update `LogSource.ToDto()` mapping. Every `GET` now returns prefix-only.
- [ ] **4.B — `LogSourceCreatedDto` new record.** One-time shape that wraps `LogSourceDto` + cleartext `ApiKey`. Only returned by create and regenerate endpoints.
- [ ] **4.C — `CreateLogSourceCommand` handler update.** Return `LogSourceCreatedDto` instead of `LogSourceDto`. Use `IApiKeyHasher.Generate()`, persist `KeyHash`/`KeyPrefix`, audit-log `LogSourceKeyCreated` and `LogSourceKeyRevealed`.
- [ ] **4.D — `RegenerateLogSourceKeyCommand` + Handler + Validator** per plan body §2.3. Hard-cut behaviour: write new hash + prefix, set `KeyRotatedAt`, audit-log, save. No grace.
- [ ] **4.E — `DeleteLogSourceCommand` + Handler + Validator** per §2.4. `IsActive = false` first, then soft-delete via the EF interceptor.
- [ ] **4.F — `TestIngestLogSourceCommand` + Handler + `TestIngestResultDto`** per §2.7. Publishes a `LogBatchMessage` tagged `metadata.synthetic = true`. Counts against rate-limit but skips alert-rule evaluation in the consumer.
- [ ] **4.G — `LogBatchConsumer` synthetic-batch skip.** Single `if (batch.IsSynthetic) skipRuleEvaluation();` branch in `src/backend/StackSift.Infrastructure/Messaging/LogBatchConsumer.cs`. Synthetic events are indexed (so the live tail shows them) but never fire alerts.
- [ ] **4.H — `GetOrganizationLogSourcesQuery` + Handler** per §2.11. Reuses `ILogSourceRepository.GetByOrgAsync()` (new method — add to interface + impl, ignores project filter).
- [ ] **4.I — `ILogSourceRepository.GetActiveByKeyPrefixAsync`** for the ingestion path's prefix-indexed lookup. Returns only `IsActive` rows so deleted/disabled sources can never authenticate.
- [ ] **4.J — `ILogSourceRepository.TouchKeyLastUsedAsync`.** Single-column update; fire-and-forget from the middleware (no `await`), no transaction. Used for the "last used" telemetry on the integration page.
- [ ] **4.K — `LogSourcesController` (new top-level controller)** at `src/backend/StackSift.Api/Controllers/LogSourcesController.cs`. Routes per §2.5: `GET /{id}`, `GET /` (org-wide), `POST /{id}/regenerate-key`, `DELETE /{id}`, `POST /{id}/test-ingest`. Each action documents OpenAPI responses per project convention.
- [ ] **4.L — `ApiKeyAuthMiddleware` rewrite** to use the prefix-indexed lookup + `IApiKeyHasher.Verify`. Constant-time path; falls through to JWT when the header is missing or the prefix doesn't match. Fire-and-forget `TouchKeyLastUsedAsync` on success.
- [ ] **4.M — `ProjectsController` create-action update.** Returns 201 with `LogSourceCreatedDto` (containing the one-time `apiKey`). Same response shape as the new regenerate endpoint so the frontend can share `ApiKeyRevealModal`.

### Phase 5 — Backend integration tests (~4 hours, depends on Phase 4)

The cross-tenant / role-based tests are the closest thing this plan has to a security gate. Write them while the backend is fresh in mind.

- [ ] **5.A — `LogSourcesControllerTests` (new file).** Patterned on `IncidentsControllerTests`. Cases:
  - `Create_HappyPath_Returns201WithCreatedDto` — creates, asserts response contains cleartext `apiKey` and matching prefix.
  - `Create_WrongOrgProject_Returns404` — Org-B admin posting to Org-A's project.
  - `Get_ReturnsPrefixOnly` — list and single-get both lack any `apiKey` field.
  - `Regenerate_HappyPath_OldKeyImmediatelyRejected` — POST regenerate, then attempt ingest with the original key, expect 401.
  - `Regenerate_WrongOrg_Returns404`.
  - `Regenerate_AsMember_Returns403`.
  - `Delete_HappyPath_RemovesFromListAndRejectsIngestion`.
  - `Delete_AsMember_Returns403`.
  - `TestIngest_HappyPath_Returns200WithSyntheticId`.
  - `TestIngest_RateLimited_Returns429AfterBucketEmpty` (verifies the test-ingest counts against the existing `LogIngest` policy).
- [ ] **5.B — Migration backfill round-trip test.** Pre-migration fixture inserts a `LogSource` row via raw SQL with a cleartext `ApiKey`. Run the migration. Assert: hash + prefix populated, ingest with the original cleartext still succeeds (validates the backfill formula).
- [ ] **5.C — `ApiKeyAuthMiddleware` test.** Three cases: valid key authenticates with the synthesised principal; tampered key returns 401 in O(1); inactive source rejects.
- [ ] **5.D — `IAuditLog` test.** Create → expect one row; regenerate → expect one row; delete → expect one row; each row carries the acting user's email and the target ID.

### Phase 6 — Frontend hooks + Zod schemas (~3 hours)

All independent. Two engineers can split between schemas and hooks if desired.

- [ ] **6.A — Zod schema updates.** `LogSourceSchema` in `src/frontend/src/app/lib/api-schemas.ts`: drop `apiKey`, add `keyPrefix`, `keyLastUsedAt`, `keyRotatedAt`. Add `LogSourceCreatedSchema` for the one-time reveal shape.
- [ ] **6.B — TypeScript types** in `src/frontend/src/app/types/api.ts` aligned with the schemas (using `z.infer` from the schema file as in the existing pattern).
- [ ] **6.C — `useLogSource(id)` query** at `src/frontend/src/app/hooks/queries/use-log-source.ts`. New file; covers `GET /api/v1/log-sources/{id}`.
- [ ] **6.D — `useOrganizationLogSources()` query** at `src/frontend/src/app/hooks/queries/use-organization-log-sources.ts`. Covers `GET /api/v1/log-sources` (org-wide list — §2.11).
- [ ] **6.E — `useRegenerateLogSourceKey` mutation** per plan body §2.3. Invalidates the list + detail queries; returns `LogSourceCreated` for the modal consumer.
- [ ] **6.F — `useDeleteLogSource` mutation.** On success, invalidate the project's log-source list and navigate to `/projects/{projectId}`.
- [ ] **6.G — `useTestIngest` mutation.** Returns `TestIngestResult`; surfaces a success toast with "Sent at \<timestamp\>" + a "View in live tail" link.
- [ ] **6.H — Update `useCreateLogSource`** (if it exists, else update the wizard's inline post mutation). Return type becomes `LogSourceCreated`; the consumer opens the reveal modal.

### Phase 7 — Reveal modal & create-flow integration (~3 hours, depends on Phase 6)

The single most product-critical UX surface in this plan. Get the "you cannot accidentally lose your key" behaviour right.

- [ ] **7.A — `ApiKeyRevealModal` component** at `src/frontend/src/app/components/dialogs/ApiKeyRevealModal.tsx`. Props: `apiKey`, `keyPrefix`, `onConfirmed`. Features: read-only `<code>` block showing the full key once; copy-to-clipboard button (with a 2-second "Copied!" indicator); a checkbox labelled "I have saved this key somewhere safe — I understand it will not be shown again"; the "Done" button is disabled until that checkbox is checked. Closing via Esc or backdrop click is suppressed (the modal MUST be confirmed).
- [ ] **7.B — `CopyableCode` shared component** at `src/frontend/src/app/components/ui/CopyableCode.tsx` if one doesn't already exist (used by the reveal modal and the integration recipe snippets). Optional `language` prop for `<code>` styling.
- [ ] **7.C — Wire reveal into the create-source flow.** Wherever `useCreateLogSource` is called (currently inside the project wizard's submit path), open the modal with the cleartext key on success. After modal confirmation, navigate to `/log-sources/{id}` (the integration page) — not back to the project detail.
- [ ] **7.D — Wire reveal into the regenerate flow.** Same modal; mounted from `LogSourceIntegrationView`.

### Phase 8 — Log-source detail / integration page (~5 hours)

The customer-facing landing surface. This is what makes the key actionable.

- [ ] **8.A — Route file** `src/frontend/src/app/(dashboard)/log-sources/[id]/page.tsx`. Async server component per Next 16 (`params` is a Promise — see `AGENTS.md`).
- [ ] **8.B — `LogSourceIntegrationView` client component** per plan body §2.6. Header (name + masked key + last-used), action buttons (test ingest / regenerate / delete — last two gated by `useCurrentUserRole().isAdminOrAbove`), tabbed snippet panel (curl / serilog / winston).
- [ ] **8.C — `CurlSnippet` component** with the full POST shape, ingest URL pulled from `NEXT_PUBLIC_API_URL` + `/api/v1/logs/ingest`, masked key placeholder.
- [ ] **8.D — `SerilogSnippet` component** with the .NET sink config. **Plan 03 owns the canonical content** — this version is placeholder text that says "See `StackSift.Serilog.Sink` on NuGet" plus a minimal example. Per Decision 0.4, hard-coded for now; Plan 03 replaces.
- [ ] **8.E — `WinstonSnippet` component.** Same shape; placeholder for the `@stacksift/winston-transport` Node SDK from Plan 03.
- [ ] **8.F — Delete confirmation dialog.** Typed-name modal (user must type the source name verbatim) modelled on the existing `DeleteProjectDialog` if one exists; otherwise a new `ConfirmDeleteByNameDialog` shared component since two callers want it.
- [ ] **8.G — Regenerate confirmation dialog.** Simpler — just "are you sure?" with explicit text "This will immediately invalidate the current key. Any service still using it will start receiving 401 errors." Standard two-button modal.

### Phase 9 — Settings → API page (~2 hours, Decision 0.3 = ship)

- [ ] **9.A — Route file** `src/frontend/src/app/(dashboard)/settings/api/page.tsx`. Server component pulls `useOrganizationLogSources` via the server-component data path or punts to the client.
- [ ] **9.B — `LogSourcesTable` component.** Columns: Project, Source name, Type badge, Key prefix (`<code>`), Last used (relative time), Actions (link to integration page). Sort by Last used desc by default.
- [ ] **9.C — Settings nav link.** Add "API" to the settings sidebar between existing entries; route it to `/settings/api`.

### Phase 10 — Wizard post-create rewire (~30 min)

Plan 01 §4.A already stripped the dead step. This phase wires the new create-success flow.

- [ ] **10.A — Update `NewProjectWizard`'s submit handler.** The wizard creates the *project only*, not a log source. Wait — verify: does the current wizard create both? Re-read `useCreateProject` and the project create response (now just `Project` per Plan 01). If only the project is created, log-source creation happens on the project detail page → integration page flow (Phase 8). If the wizard ALSO creates a source, re-check whether that's still desired.
  - **Note:** as of Plan 01's cleanup, the wizard creates the project only and does NOT create a log source. Customer creates the log source separately from the project detail page. Confirm and document this in the wizard's leading comment.
- [ ] **10.B — Update project-detail "Add log source" affordance** at `src/frontend/src/app/(dashboard)/projects/[id]/_components/ProjectDetailView.tsx` (or wherever the empty-state lives). Add a `<Button onClick={() => setOpen(true)}>Add log source</Button>` that opens a small `<AddLogSourceDialog>` (just name + type radio — see Decision 0.4 for type semantics). Submitting calls `useCreateLogSource`, which on success opens the §7.A reveal modal and then routes to `/log-sources/{id}`.

### Phase 11 — Verification (~1 hour)

Run in this order to fail fast on cheap checks. Mirrors Plan 01 Phase 6.

- [ ] **11.A — Static checks**: `dotnet build` (0 errors), `pnpm exec tsc --noEmit`, `pnpm exec eslint src/`.
- [ ] **11.B — Test suites**: `dotnet test` (count goes up from Plan 01's 233 floor by the 10 new integration cases + the new hasher unit test). `pnpm exec jest` (count goes up by the modal + dialog + new-page tests).
- [ ] **11.C — Contract grep audit** (Plan 01 §6.C pattern): every `/api/v1/log-sources/*` route the frontend calls is backed by a real controller action.
- [ ] **11.D — Pepper-rotation drill.** Generate a second pepper, swap the config, restart the API, attempt ingest with a previously-working key. Expected: 401. Restore the original pepper, retry: 200. Validates that the pepper is actually part of the verification chain (not a config-only constant ignored by the hasher).
- [ ] **11.E — Manual smoke test** (cannot be automated in this session):
  1. Sign in.
  2. Create a project.
  3. Add a log source from the project detail page.
  4. Reveal modal appears; check the box; copy the key; confirm.
  5. Land on `/log-sources/{id}`.
  6. Click "Send test event" → green toast.
  7. Open another tab to the project detail's log list → the synthetic event appears.
  8. Back on the integration page, click "Regenerate key". Confirm. Get a new key from the reveal modal.
  9. Use `curl` with the *old* key → 401.
  10. Use `curl` with the *new* key → 202.
  11. Click "Delete". Type the source name. Confirm. Land back on the project detail page; the source is gone.
  12. As a Member (non-Admin) user, repeat steps 7–11. Test-ingest works; regenerate and delete buttons are hidden in the UI; direct backend calls return 403.
- [ ] **11.F — Audit log spot check.** After the manual smoke run, `SELECT * FROM audit_log_entries ORDER BY occurred_at DESC LIMIT 20` shows: 1 × `LogSourceKeyCreated`, 1 × `LogSourceKeyRevealed`, 1 × `LogSourceKeyRegenerated`, 1 × `LogSourceDeleted`, all attributed to the test user and the right source ID.
- [ ] **11.G — Trello move** PD-02 card to "Acceptance pending"; the PR description references Plan 02 and links to this checklist.

### Effort total

| Phase | Hours | Cumulative |
|-------|-------|------------|
| 0 — Decisions                          | 0.5  | 0.5  |
| 1 — Hasher & config                    | 2    | 2.5  |
| 2 — Schema migration                   | 3    | 5.5  |
| 3 — Audit log infrastructure           | 3    | 8.5  |
| 4 — Backend application + controllers  | 8    | 16.5 |
| 5 — Backend integration tests          | 4    | 20.5 |
| 6 — Frontend hooks + schemas           | 3    | 23.5 |
| 7 — Reveal modal & create flow         | 3    | 26.5 |
| 8 — Log-source detail / integration    | 5    | 31.5 |
| 9 — Settings → API page                | 2    | 33.5 |
| 10 — Wizard post-create rewire         | 0.5  | 34   |
| 11 — Verification                      | 1    | 35   |

~35 engineer-hours = 4.5 working days solo. Matches the header's 4–5 day estimate.

### PR strategy

Single PR is *not* recommended here — Plan 02 touches the security boundary and the cleanest review path is a small stack:

- **PR-1 (Phases 1–3):** `feat(api-keys): HMAC hasher + audit log + schema migration`. Self-contained foundation; reviewable for crypto correctness and migration safety without any UX noise. Cannot be deployed alone (the rest of the backend still references `ApiKey`).
- **PR-2 (Phases 4–5):** `feat(log-sources): regenerate/delete/test-ingest endpoints + new controller`. Lands the full backend surface plus integration tests. Deployable to the dev environment without the frontend.
- **PR-3 (Phases 6–10):** `feat(log-sources): API key UX (reveal modal + integration page + settings)`. All frontend work in one PR — reviewable end-to-end as a coherent customer flow.

Per project memory `feedback_pr_workflow.md`: push the branches; the founder opens each PR. Per `feedback_fix_branches.md`: do not push until Phase 11 has been fully verified end-to-end locally.

Branch naming: `feat/api-key-foundation`, `feat/log-source-endpoints`, `feat/log-source-ux`. Stacked on each other (rebase the second on the first as it merges).

---

## Current state

### Backend

`POST /api/v1/projects/{id}/log-sources` (`src/backend/StackSift.Api/Controllers/ProjectsController.cs:106-116`) creates a `LogSource` row, mints an API key, and returns the full `LogSourceDto` — **API key included** — to the caller exactly once. After that, every subsequent `GET` also returns the cleartext key:

```csharp
// src/backend/StackSift.Application/Commands/LogSources/CreateLogSourceCommand.cs:34
var apiKey = Guid.NewGuid().ToString("N");
var logSource = new LogSource
{
    Id = Guid.NewGuid(),
    ProjectId = request.ProjectId,
    OrganizationId = currentUser.OrganizationId,
    Name = request.Name,
    Type = request.Type,
    IngestUrl = $"/api/v1/logs/ingest",
    ApiKey = apiKey,
    IsActive = true
};
```

The entity stores the key as a plain `string`:

```csharp
// src/backend/StackSift.Domain/Entities/LogSource.cs:6-16
public class LogSource : AuditableEntity<Guid>
{
    public Guid ProjectId { get; set; }
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public LogSourceType Type { get; set; }
    public string IngestUrl { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public DateTimeOffset? LastSeenAt { get; set; }
}
```

The DTO carries it too (`src/backend/StackSift.Application/DTOs/LogSourceDto.cs:5-16` — field `ApiKey`).

The EF configuration only indexes the key, no uniqueness constraint, no `KeyHash`/`KeyPrefix` columns, no soft-delete column override:

```csharp
// src/backend/StackSift.Infrastructure/Persistence/Configurations/LogSourceConfiguration.cs:14-21
builder.Property(e => e.Name).IsRequired().HasMaxLength(200);
builder.Property(e => e.Type).HasConversion<string>().IsRequired();
builder.Property(e => e.IngestUrl).IsRequired().HasMaxLength(500);
builder.Property(e => e.ApiKey).IsRequired().HasMaxLength(200);
builder.HasIndex(e => e.ApiKey);
builder.HasQueryFilter(e => !e.IsDeleted);
```

`ApiKeyAuthMiddleware` (`src/backend/StackSift.Api/Middleware/ApiKeyAuthMiddleware.cs:12-31`) does a direct equality lookup against `ApiKey` and synthesises a `member`-role principal.

There is **no** regenerate endpoint, **no** delete endpoint, **no** rotate endpoint, **no** audit log. `grep -r "regenerate\|RotateKey" src/backend` returns nothing relevant.

### Frontend

The project detail view is the only surface that renders log sources. It deliberately ignores the `apiKey` field:

```tsx
// src/frontend/src/app/(dashboard)/projects/[id]/_components/ProjectDetailView.tsx:30-52
function LogSourceRow({ source }: { source: LogSource }) {
  return (
    <div className="flex items-center justify-between rounded-lg border ...">
      <div className="flex items-center gap-3">
        <span className="text-zinc-400">{LOG_SOURCE_ICONS[source.type]}</span>
        <div>
          <p className="text-sm font-medium">{source.name}</p>
          <p className="text-xs text-zinc-500 font-mono">{source.ingestUrl}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={source.isActive ? 'info' : 'neutral'}>
          {source.isActive ? 'Active' : 'Inactive'}
        </Badge>
        {source.lastSeenAt && (
          <span className="hidden text-xs text-zinc-400 sm:inline">
            Last seen {new Date(source.lastSeenAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}
```

The Zod schema and TS type include `apiKey` but nothing renders it (`src/frontend/src/app/lib/api-schemas.ts:51`, `src/frontend/src/app/types/domain.ts:52`).

The "new project" wizard step 2 (`src/frontend/src/app/(dashboard)/projects/new/_components/ProjectLogSourceStep.tsx:39-60`) asks the user to type in an "Ingest endpoint URL" or "Log file path" — which are saved on the LogSource row and then never read again. The wizard collects metadata the platform doesn't use, and never shows the one piece of metadata (the key) the customer actually needs.

### Net effect

A customer cannot complete the integration journey. The product spine works; the productisation does not.

---

## Target state

After this plan ships, a customer can:

1. Create a log source from the wizard and see the API key **once**, in a modal, with a copy-to-clipboard button and an explicit "I have saved it" confirmation step.
2. List log sources and see the key prefix (first 8 chars) + an "Active / Inactive" badge — never the full key.
3. Regenerate a key from the log source detail page. The old key stops authenticating immediately (or after a configured grace period). The new key is shown once, same UX as creation.
4. Delete a log source from the log source detail page with a confirmation modal that requires typing the source name.
5. Open an **Integration** tab per log source with a curl example, a language-specific snippet (link out to Plan 03's SDK), and a "Test ingest" button that POSTs a single synthetic log entry on the user's behalf and reports success.
6. Be subject to a permission model where only Org Admins (or above) can regenerate or delete; Members can view prefix + ingest URL only.
7. Have all key reveals, regenerations, and deletions recorded in an audit log for later compliance review.

After this plan, a stranger who signs up at 09:00 can be sending real logs by 09:10, with no support contact.

---

## Tasks

### 2.1 — Replace cleartext storage with `KeyHash` + `KeyPrefix`

**Why:** Today `LogSource.ApiKey` is a 32-char hex string stored verbatim in Postgres. Anyone with read access to the DB has every customer's bearer token. Industry standard (Stripe, GitHub, Vercel) is to store a hash plus a short non-secret prefix for display.

**Implementation:**

EF entity:

```csharp
// src/backend/StackSift.Domain/Entities/LogSource.cs — new shape
public class LogSource : AuditableEntity<Guid>
{
    public Guid ProjectId { get; set; }
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public LogSourceType Type { get; set; }
    public string IngestUrl { get; set; } = string.Empty;

    // NEW — replaces the cleartext ApiKey column
    public string KeyHash { get; set; } = string.Empty;
    public string KeyPrefix { get; set; } = string.Empty;   // first 8 chars of cleartext
    public DateTimeOffset? KeyLastUsedAt { get; set; }
    public DateTimeOffset? KeyRotatedAt { get; set; }

    public bool IsActive { get; set; } = true;
    public DateTimeOffset? LastSeenAt { get; set; }
}
```

Configuration:

```csharp
// src/backend/StackSift.Infrastructure/Persistence/Configurations/LogSourceConfiguration.cs
public void Configure(EntityTypeBuilder<LogSource> builder)
{
    builder.HasKey(e => e.Id);
    builder.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
    builder.Property(e => e.Name).IsRequired().HasMaxLength(200);
    builder.Property(e => e.Type).HasConversion<string>().IsRequired();
    builder.Property(e => e.IngestUrl).IsRequired().HasMaxLength(500);

    builder.Property(e => e.KeyHash).IsRequired().HasMaxLength(128);
    builder.Property(e => e.KeyPrefix).IsRequired().HasMaxLength(16);

    // Unique on hash so two log sources can never share a derived key
    builder.HasIndex(e => e.KeyHash).IsUnique();
    builder.HasIndex(e => e.KeyPrefix);  // for prefix lookup during validation

    builder.HasQueryFilter(e => !e.IsDeleted);
}
```

Migration `20260528_AddLogSourceKeyHashing`:

1. Add `KeyHash`, `KeyPrefix`, `KeyLastUsedAt`, `KeyRotatedAt`.
2. For each existing row, compute `KeyPrefix = substring(ApiKey, 1, 8)` and `KeyHash = hash(ApiKey)` (one-off Postgres function — see below).
3. Drop the `ApiKey` column.

The hash algorithm is **HMAC-SHA-256 with a server-side pepper** (NOT BCrypt/Argon2). Reason: ingestion paths must validate the key on every single batch (100/min/key rate limit, but easily 1000/sec across the platform). BCrypt at sane work factors costs ~50 ms per check; HMAC-SHA-256 costs ~10 µs and gives equivalent security against offline attack when paired with a 32-byte random pepper. Stripe, GitHub, Vercel all use HMAC for the same reason. The pepper lives in `IConfiguration["LogSources:KeyPepper"]` and goes into the secret manager.

```csharp
// src/backend/StackSift.Application/Interfaces/IApiKeyHasher.cs — new
namespace StackSift.Application.Interfaces;

public interface IApiKeyHasher
{
    /// <summary>Generate a fresh cleartext key. Returns (cleartext, prefix, hash).</summary>
    (string Cleartext, string Prefix, string Hash) Generate();

    /// <summary>Recompute hash for a candidate cleartext and constant-time compare.</summary>
    bool Verify(string candidate, string expectedHash);

    /// <summary>Used during the data migration to backfill existing rows.</summary>
    string Hash(string cleartext);
}
```

```csharp
// src/backend/StackSift.Infrastructure/Identity/HmacApiKeyHasher.cs — new
public sealed class HmacApiKeyHasher(IOptions<LogSourceOptions> options) : IApiKeyHasher
{
    private readonly byte[] _pepper = Convert.FromBase64String(options.Value.KeyPepperBase64);

    public (string Cleartext, string Prefix, string Hash) Generate()
    {
        // 32 random bytes → 43-char base64url. Prefix the result with "ss_" for
        // grep-ability in customer logs (Stripe-style).
        Span<byte> buf = stackalloc byte[32];
        RandomNumberGenerator.Fill(buf);
        var body = WebEncoders.Base64UrlEncode(buf);
        var cleartext = $"ss_{body}";
        var prefix = cleartext[..8];           // "ss_AbCd"
        var hash = Hash(cleartext);
        return (cleartext, prefix, hash);
    }

    public string Hash(string cleartext)
    {
        using var hmac = new HMACSHA256(_pepper);
        var raw = hmac.ComputeHash(Encoding.UTF8.GetBytes(cleartext));
        return Convert.ToHexString(raw);       // 64-char hex
    }

    public bool Verify(string candidate, string expectedHash)
    {
        var actual = Hash(candidate);
        // Constant-time compare to avoid timing side-channels.
        return CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(actual),
            Encoding.ASCII.GetBytes(expectedHash));
    }
}
```

`ApiKeyAuthMiddleware` becomes prefix-indexed (so we don't hash every row in the table):

```csharp
// src/backend/StackSift.Api/Middleware/ApiKeyAuthMiddleware.cs
public async Task InvokeAsync(HttpContext context,
    ILogSourceRepository logSourceRepository,
    IApiKeyHasher hasher)
{
    if (context.User.Identity?.IsAuthenticated != true &&
        context.Request.Headers.TryGetValue("X-API-Key", out var key))
    {
        var cleartext = key.ToString();
        if (cleartext.Length < 8) { await next(context); return; }

        var prefix = cleartext[..8];
        var candidates = await logSourceRepository.GetActiveByKeyPrefixAsync(prefix);

        var match = candidates.FirstOrDefault(ls => hasher.Verify(cleartext, ls.KeyHash));
        if (match is { IsActive: true })
        {
            // ... synthesise principal as before ...
            // fire-and-forget update of KeyLastUsedAt
            _ = logSourceRepository.TouchKeyLastUsedAsync(match.Id);
        }
    }
    await next(context);
}
```

**Acceptance:**

- `GET /api/v1/projects/{id}/log-sources` returns no `apiKey` field, only `keyPrefix`.
- `POST /api/v1/logs/ingest` with the **original** key from creation still authenticates.
- Hitting the same endpoint with a tampered key returns 401 in O(1) time regardless of which org owned the source.
- The `LogSources` table has no `ApiKey` column after the migration.

### 2.2 — Show the API key once on creation

**Why:** A bearer secret must be displayed exactly once and stored client-side by the user, never recoverable from the server. This is the same flow GitHub Personal Access Tokens use.

**Implementation:**

Update DTO to carry a *one-time* cleartext field only on the create response:

```csharp
// src/backend/StackSift.Application/DTOs/LogSourceDto.cs — list/get shape
public record LogSourceDto(
    Guid Id,
    Guid ProjectId,
    Guid OrganizationId,
    string Name,
    LogSourceType Type,
    string IngestUrl,
    string KeyPrefix,
    bool IsActive,
    DateTimeOffset? LastSeenAt,
    DateTimeOffset? KeyLastUsedAt,
    DateTimeOffset? KeyRotatedAt,
    DateTimeOffset CreatedAt);

// src/backend/StackSift.Application/DTOs/LogSourceCreatedDto.cs — new
public record LogSourceCreatedDto(
    LogSourceDto Source,
    string ApiKey  // one-time reveal — only returned by POST create
);
```

Handler:

```csharp
// src/backend/StackSift.Application/Commands/LogSources/CreateLogSourceCommand.cs
public record CreateLogSourceCommand(Guid ProjectId, string Name, LogSourceType Type)
    : IRequest<LogSourceCreatedDto>;

public class CreateLogSourceCommandHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser,
    IApiKeyHasher hasher,
    IAuditLog audit)
    : IRequestHandler<CreateLogSourceCommand, LogSourceCreatedDto>
{
    public async Task<LogSourceCreatedDto> Handle(CreateLogSourceCommand request, CancellationToken ct)
    {
        var project = await uow.Projects.GetByIdAsync(request.ProjectId, ct)
            ?? throw new NotFoundException(nameof(Project), request.ProjectId);
        if (project.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(Project), request.ProjectId);

        var (cleartext, prefix, hash) = hasher.Generate();
        var logSource = new LogSource
        {
            Id = Guid.NewGuid(),
            ProjectId = request.ProjectId,
            OrganizationId = currentUser.OrganizationId,
            Name = request.Name,
            Type = request.Type,
            IngestUrl = "/api/v1/logs/ingest",
            KeyHash = hash,
            KeyPrefix = prefix,
            IsActive = true
        };
        await uow.LogSources.AddAsync(logSource, ct);
        await audit.RecordAsync(AuditEvent.LogSourceKeyCreated, logSource.Id, ct);
        await uow.SaveChangesAsync(ct);

        return new LogSourceCreatedDto(logSource.ToDto(), cleartext);
    }
}
```

Frontend one-time reveal modal:

```tsx
// src/frontend/src/app/(dashboard)/projects/[id]/_components/ApiKeyRevealModal.tsx — new
'use client';
import { useState } from 'react';
import { Copy, Check, AlertTriangle } from 'lucide-react';

interface Props {
  apiKey: string;
  ingestUrl: string;
  onClose: () => void;
}

export function ApiKeyRevealModal({ apiKey, ingestUrl, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 dark:bg-zinc-900">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-500" aria-hidden="true" />
          <div className="flex-1">
            <h2 className="text-base font-semibold">Save this key now</h2>
            <p className="mt-1 text-sm text-zinc-500">
              We will never show this value again. If you lose it you will need to regenerate.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-sm dark:border-zinc-700 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-2">
            <code className="truncate">{apiKey}</code>
            <button
              onClick={copy}
              aria-label="Copy API key"
              className="rounded p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          I have saved this key in a secure place.
        </label>

        <div className="mt-6 flex justify-end gap-2">
          <button
            disabled={!confirmed}
            onClick={onClose}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            I have saved it — close
          </button>
        </div>
      </div>
    </div>
  );
}
```

The wizard's "Finish" step calls the create mutation, then opens this modal with `result.apiKey` and `result.source.ingestUrl`. The user is forced to check the box before they can close.

Zod schema update:

```ts
// src/frontend/src/app/lib/api-schemas.ts
export const LogSourceSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  organizationId: z.uuid(),
  name: z.string(),
  type: LogSourceTypeSchema,
  ingestUrl: z.string(),
  keyPrefix: z.string(),
  isActive: z.boolean(),
  lastSeenAt: z.iso.datetime().nullable(),
  keyLastUsedAt: z.iso.datetime().nullable(),
  keyRotatedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
});

export const LogSourceCreatedSchema = z.object({
  source: LogSourceSchema,
  apiKey: z.string(),       // present only on create
});
```

**Acceptance:**

- After creating a log source, the modal appears with the cleartext key.
- Closing the modal without checking the box is impossible (button stays disabled).
- After the modal closes, reloading the page shows `ss_AbCd…` (prefix only).
- `GET` endpoints never return a field named `apiKey`.

### 2.3 — Regenerate endpoint

**Why:** Keys leak. A customer must be able to mint a new key and invalidate the old one without deleting the log source (which would break their dashboards / alert rules tied to that source).

**Implementation:**

```csharp
// src/backend/StackSift.Application/Commands/LogSources/RegenerateLogSourceKeyCommand.cs — new
public record RegenerateLogSourceKeyCommand(Guid LogSourceId) : IRequest<LogSourceCreatedDto>;

public class RegenerateLogSourceKeyCommandValidator : AbstractValidator<RegenerateLogSourceKeyCommand>
{
    public RegenerateLogSourceKeyCommandValidator()
        => RuleFor(x => x.LogSourceId).NotEqual(Guid.Empty);
}

public class RegenerateLogSourceKeyCommandHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser,
    IApiKeyHasher hasher,
    IAuditLog audit)
    : IRequestHandler<RegenerateLogSourceKeyCommand, LogSourceCreatedDto>
{
    public async Task<LogSourceCreatedDto> Handle(RegenerateLogSourceKeyCommand request, CancellationToken ct)
    {
        var source = await uow.LogSources.GetByIdAsync(request.LogSourceId, ct)
            ?? throw new NotFoundException(nameof(LogSource), request.LogSourceId);
        if (source.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(LogSource), request.LogSourceId);

        var (cleartext, prefix, hash) = hasher.Generate();
        source.KeyHash = hash;
        source.KeyPrefix = prefix;
        source.KeyRotatedAt = DateTimeOffset.UtcNow;

        await audit.RecordAsync(AuditEvent.LogSourceKeyRegenerated, source.Id, ct);
        await uow.SaveChangesAsync(ct);

        return new LogSourceCreatedDto(source.ToDto(), cleartext);
    }
}
```

Controller addition to `LogSourcesController` (new sibling to `ProjectsController` — see §2.5 for the new resource layout):

```csharp
[HttpPost("{id:guid}/regenerate-key")]
[Authorize(Policy = "AdminOrAbove")]
[ProducesResponseType(typeof(LogSourceCreatedDto), StatusCodes.Status200OK)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
public async Task<IActionResult> RegenerateKey(Guid id, CancellationToken ct)
    => Ok(await Mediator.Send(new RegenerateLogSourceKeyCommand(id), ct));
```

**Grace-period decision:** hard cut, no grace. Rationale: the customer is regenerating *because* the old key is compromised. A 24-hour grace period extends the window of abuse. If the customer needs zero-downtime rotation they should create a second log source, migrate traffic, then delete the first. This is the GitHub PAT model and it works.

**Frontend hook:**

```ts
// src/frontend/src/app/hooks/mutations/use-regenerate-log-source-key.ts — new
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/app/lib/api-client';
import { LogSourceCreatedSchema, type LogSourceCreated } from '@/app/lib/api-schemas';
import { queryKeys } from '@/app/lib/query-keys';

export function useRegenerateLogSourceKey() {
  const qc = useQueryClient();
  return useMutation<LogSourceCreated, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      const res = await apiClient.post(
        `/api/v1/log-sources/${id}/regenerate-key`,
        undefined,
        { schema: LogSourceCreatedSchema },
      );
      return res.data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.logSources.byProject() });
      qc.invalidateQueries({ queryKey: queryKeys.logSources.detail(vars.id) });
    },
  });
}
```

UI: a "Regenerate" button on the log source detail page, gated by `useCurrentUserRole().isAdminOrAbove`, that opens a confirmation modal. On confirm, calls the mutation and reuses `ApiKeyRevealModal` for the result.

**Acceptance:**

- An old key returns 401 on the very next ingestion attempt after regeneration.
- Members (non-Admin) calling the endpoint get 403.
- `KeyRotatedAt` reflects the regeneration time.
- The audit log row is written before the DB commit.

### 2.4 — Delete endpoint

**Why:** Log sources accumulate. A customer who decommissions a service needs to delete its log source. The current `LogSource` already supports soft-delete via `AuditableEntity` and the query filter `!e.IsDeleted`, but no endpoint exposes it.

**Implementation:**

```csharp
// src/backend/StackSift.Application/Commands/LogSources/DeleteLogSourceCommand.cs — new
public record DeleteLogSourceCommand(Guid LogSourceId) : IRequest<Unit>;

public class DeleteLogSourceCommandHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser,
    IAuditLog audit)
    : IRequestHandler<DeleteLogSourceCommand, Unit>
{
    public async Task<Unit> Handle(DeleteLogSourceCommand request, CancellationToken ct)
    {
        var source = await uow.LogSources.GetByIdAsync(request.LogSourceId, ct)
            ?? throw new NotFoundException(nameof(LogSource), request.LogSourceId);
        if (source.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(LogSource), request.LogSourceId);

        source.IsActive = false;     // stop authenticating immediately
        uow.LogSources.Remove(source);  // EF interceptor flips IsDeleted = true
        await audit.RecordAsync(AuditEvent.LogSourceDeleted, source.Id, ct);
        await uow.SaveChangesAsync(ct);
        return Unit.Value;
    }
}
```

**Soft-delete decision:** soft for the row (preserves audit/incident history that references `LogSourceId`), but `IsActive = false` is set *first* so the API key cannot authenticate even before the EF interceptor runs. ES log entries indexed against the deleted source are kept — the retention job will sweep them later. This is consistent with the project soft-delete behaviour (`DeleteProjectCommand` already uses soft-delete via `AdminOrAbove`).

Controller:

```csharp
[HttpDelete("{id:guid}")]
[Authorize(Policy = "AdminOrAbove")]
[ProducesResponseType(StatusCodes.Status204NoContent)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
public async Task<IActionResult> DeleteLogSource(Guid id, CancellationToken ct)
{
    await Mediator.Send(new DeleteLogSourceCommand(id), ct);
    return NoContent();
}
```

UI confirmation: a typed-name confirmation modal ("Type `<name>` to confirm") modelled on GitHub's repo delete dialog. Same pattern as `DeleteProjectDialog` (already exists).

**Acceptance:**

- After deletion, the source no longer appears in `GET /api/v1/projects/{id}/log-sources`.
- An ingest call with the deleted source's last-known key returns 401.
- Alerts and incidents that referenced this source still load (their `LogSourceId` FK is honoured via raw `Set`, not via the org-scoped repo).

### 2.5 — Promote log sources to a top-level resource

**Why:** Today log sources are only reachable through the nested `/projects/{id}/log-sources` route. Regenerate, delete, and the future "Settings → API" page all need direct addressing. Adding a sibling controller without removing the nested routes preserves backward compatibility.

**Implementation:**

```csharp
// src/backend/StackSift.Api/Controllers/LogSourcesController.cs — new
[Route("api/v1/log-sources")]
public class LogSourcesController(MediatR.IMediator mediator) : BaseApiController(mediator)
{
    /// <summary>Get a single log source by ID (no API key returned).</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(LogSourceDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetLogSource(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new GetLogSourceByIdQuery(id), ct));

    /// <summary>Regenerate the API key for this log source.</summary>
    [HttpPost("{id:guid}/regenerate-key")]
    [Authorize(Policy = "AdminOrAbove")]
    public async Task<IActionResult> RegenerateKey(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new RegenerateLogSourceKeyCommand(id), ct));

    /// <summary>Soft-delete a log source.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = "AdminOrAbove")]
    public async Task<IActionResult> DeleteLogSource(Guid id, CancellationToken ct)
    {
        await Mediator.Send(new DeleteLogSourceCommand(id), ct);
        return NoContent();
    }

    /// <summary>Send a single synthetic log entry — verifies the ingestion path end-to-end.</summary>
    [HttpPost("{id:guid}/test-ingest")]
    [Authorize(Policy = "MemberOrAbove")]
    public async Task<IActionResult> TestIngest(Guid id, CancellationToken ct)
        => Ok(await Mediator.Send(new TestIngestLogSourceCommand(id), ct));
}
```

The nested `POST /api/v1/projects/{id}/log-sources` and `GET /api/v1/projects/{id}/log-sources` stay where they are (`ProjectsController.cs:94-116`) — they are how the wizard creates a source and how the project detail page lists them. The new top-level routes complement, not replace.

**Acceptance:**

- All four new routes are documented in Swagger.
- The existing nested create still works exactly as before (except the response shape is now `LogSourceCreatedDto`).
- `GET /api/v1/log-sources/{id}` cross-tenant returns 404 (consistent with the project pattern).

### 2.6 — Integration recipe page per log source

**Why:** Even with the key visible, a customer needs to know what to do with it. Today there is no in-app documentation. The Swagger UI exists at `/swagger` (on the API), but it's not linked from the dashboard and it's not customer-facing.

**Implementation:**

New route `src/frontend/src/app/(dashboard)/log-sources/[id]/page.tsx`:

```tsx
// src/frontend/src/app/(dashboard)/log-sources/[id]/page.tsx — new
import { LogSourceIntegrationView } from './_components/LogSourceIntegrationView';

// Next.js 16: params is a Promise — see AGENTS.md
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LogSourceIntegrationView logSourceId={id} />;
}
```

```tsx
// src/frontend/src/app/(dashboard)/log-sources/[id]/_components/LogSourceIntegrationView.tsx — new
'use client';
import { useState } from 'react';
import { useLogSource } from '@/app/hooks/queries/use-log-source';
import { useTestIngest } from '@/app/hooks/mutations/use-test-ingest';
import { useRegenerateLogSourceKey } from '@/app/hooks/mutations/use-regenerate-log-source-key';
import { useDeleteLogSource } from '@/app/hooks/mutations/use-delete-log-source';
import { useCurrentUserRole } from '@/app/hooks/useCurrentUserRole';
import { CurlSnippet } from './CurlSnippet';
import { SerilogSnippet } from './SerilogSnippet';
import { WinstonSnippet } from './WinstonSnippet';

const TABS = ['curl', 'serilog', 'winston'] as const;
type Tab = typeof TABS[number];

export function LogSourceIntegrationView({ logSourceId }: { logSourceId: string }) {
  const { data: source, isLoading } = useLogSource(logSourceId);
  const [tab, setTab] = useState<Tab>('curl');
  const { isAdminOrAbove } = useCurrentUserRole();

  const testIngest = useTestIngest();
  const regenerate = useRegenerateLogSourceKey();
  const remove = useDeleteLogSource();

  if (isLoading || !source) return <Skeleton />;

  const ingestBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5190';
  const ingestUrl = `${ingestBaseUrl}${source.ingestUrl}`;
  const maskedKey = `${source.keyPrefix}${'•'.repeat(36)}`;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{source.name}</h1>
          <p className="text-sm text-zinc-500">
            Key <code className="font-mono">{maskedKey}</code> · last used{' '}
            {source.keyLastUsedAt
              ? new Date(source.keyLastUsedAt).toLocaleString()
              : 'never'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => testIngest.mutate({ id: logSourceId })}
            disabled={testIngest.isPending}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            {testIngest.isPending ? 'Sending…' : 'Send test event'}
          </button>
          {isAdminOrAbove && (
            <>
              <button
                onClick={() => regenerate.mutate({ id: logSourceId })}
                className="rounded-md border px-3 py-1.5 text-sm"
              >
                Regenerate key
              </button>
              <button
                onClick={() => remove.mutate({ id: logSourceId })}
                className="rounded-md border border-red-500 px-3 py-1.5 text-sm text-red-600"
              >
                Delete
              </button>
            </>
          )}
        </div>
      </header>

      <nav role="tablist" className="flex gap-2 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={tab === t ? 'border-b-2 border-blue-600 px-3 py-2' : 'px-3 py-2'}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === 'curl' && (
        <CurlSnippet
          ingestUrl={ingestUrl}
          projectId={source.projectId}
          logSourceId={source.id}
          maskedKey={maskedKey}
        />
      )}
      {tab === 'serilog' && (
        <SerilogSnippet
          ingestUrl={ingestUrl}
          projectId={source.projectId}
          logSourceId={source.id}
        />
      )}
      {tab === 'winston' && (
        <WinstonSnippet
          ingestUrl={ingestUrl}
          projectId={source.projectId}
          logSourceId={source.id}
        />
      )}
    </div>
  );
}
```

The snippet components render copy-to-clipboard `<pre>` blocks. The key is always masked in the rendered snippet — the user pastes their own key in (the integration recipe page is for *after* they have saved the key). The actual snippet content for Serilog/Winston is owned by Plan 03 and re-used here.

Example `CurlSnippet.tsx`:

```tsx
// src/frontend/src/app/(dashboard)/log-sources/[id]/_components/CurlSnippet.tsx
'use client';
import { CopyableCode } from '@/app/components/ui/CopyableCode';

interface Props { ingestUrl: string; projectId: string; logSourceId: string; maskedKey: string; }

export function CurlSnippet({ ingestUrl, projectId, logSourceId, maskedKey }: Props) {
  const snippet = `curl -X POST '${ingestUrl}' \\
  -H 'X-Api-Key: ${maskedKey}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "projectId": "${projectId}",
    "logSourceId": "${logSourceId}",
    "entries": [{
      "level": "Error",
      "message": "Checkout failed for u_42",
      "timestamp": "${new Date().toISOString()}",
      "serviceName": "checkout-svc",
      "metadata": {"orderId": "o_99"}
    }]
  }'`;
  return <CopyableCode language="bash">{snippet}</CopyableCode>;
}
```

**Acceptance:**

- The page renders for any log source the user can access.
- Cross-tenant access yields the same "not found" empty state as the project detail page.
- Snippet copy-to-clipboard works.
- Tabs switch without re-fetching.
- The `keyPrefix` is visible; the full key is never present in any rendered snippet.

### 2.7 — Test-ingest endpoint and button

**Why:** "Did this actually wire up?" is the first question a customer asks. A test-ingest endpoint lets the dashboard send a single synthetic log entry on the user's behalf — verifying the entire pipeline (auth → handler → MassTransit → consumer → ES → SignalR) in one click.

**Implementation:**

```csharp
// src/backend/StackSift.Application/Commands/LogSources/TestIngestLogSourceCommand.cs — new
public record TestIngestLogSourceCommand(Guid LogSourceId) : IRequest<TestIngestResultDto>;
public record TestIngestResultDto(Guid LogEntryId, DateTimeOffset SentAt);

public class TestIngestLogSourceCommandHandler(
    IUnitOfWork uow,
    ICurrentUserService currentUser,
    IMessagePublisher publisher)
    : IRequestHandler<TestIngestLogSourceCommand, TestIngestResultDto>
{
    public async Task<TestIngestResultDto> Handle(TestIngestLogSourceCommand request, CancellationToken ct)
    {
        var source = await uow.LogSources.GetByIdAsync(request.LogSourceId, ct)
            ?? throw new NotFoundException(nameof(LogSource), request.LogSourceId);
        if (source.OrganizationId != currentUser.OrganizationId)
            throw new NotFoundException(nameof(LogSource), request.LogSourceId);

        var entryId = Guid.NewGuid();
        var entry = new IngestLogEntryDto(
            Level: LogLevel.Information,
            Message: $"Test event from StackSift dashboard (by {currentUser.Email}).",
            Timestamp: DateTimeOffset.UtcNow,
            TraceId: entryId.ToString("N"),
            SpanId: null,
            ServiceName: "stacksift-dashboard",
            HostName: "stacksift-dashboard",
            Metadata: new() { ["synthetic"] = true });

        await publisher.PublishAsync(
            new LogBatchMessage(source.OrganizationId, source.ProjectId, source.Id, [entry]),
            ct);

        return new TestIngestResultDto(entryId, DateTimeOffset.UtcNow);
    }
}
```

The test event goes through exactly the same path real ingestion does — so a green "Test event delivered" toast proves the pipeline works for the user's key, project, and source IDs.

**Acceptance:**

- Clicking "Send test event" toasts within ~2 seconds.
- The synthetic event appears in the logs view (with `synthetic: true` in metadata).
- No alert rule fires on a synthetic entry — to be safe, the consumer skips rule evaluation when `entries.All(e => e.Metadata?.GetValueOrDefault("synthetic") is true)`. (Two-line guard in `LogBatchConsumer.cs:70`.)

### 2.8 — Audit log for key operations

**Why:** Compliance, debugging, and "who did this?" forensics. Stripe webhooks already have an idempotency log (`StripeWebhookEvent`); apply the same pattern to security-relevant key operations.

**Implementation:**

New domain entity:

```csharp
// src/backend/StackSift.Domain/Entities/AuditLogEntry.cs — new
public class AuditLogEntry
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid? UserId { get; set; }
    public string UserEmail { get; set; } = string.Empty;
    public AuditEvent Event { get; set; }
    public string TargetType { get; set; } = string.Empty;   // "LogSource", "Member", etc.
    public Guid TargetId { get; set; }
    public Dictionary<string, string>? Metadata { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
    public string? IpAddress { get; set; }
}

// src/backend/StackSift.Domain/Enums/AuditEvent.cs — new
public enum AuditEvent
{
    LogSourceKeyCreated,
    LogSourceKeyRevealed,
    LogSourceKeyRegenerated,
    LogSourceDeleted,
    MemberInvited,
    MemberRoleChanged,
    MemberRemoved,
    OrganizationCreated,
    OrganizationUpdated,
    PlanUpgraded,
    PlanDowngraded
}
```

Application abstraction (Infrastructure implements it as a one-row Postgres insert, async-safe):

```csharp
// src/backend/StackSift.Application/Interfaces/IAuditLog.cs — new
public interface IAuditLog
{
    Task RecordAsync(
        AuditEvent eventType,
        Guid targetId,
        CancellationToken ct = default,
        Dictionary<string, string>? metadata = null);
}
```

Wire it into every key handler shown in §2.2, 2.3, 2.4 (one line each — already shown in those snippets).

A future "Settings → Audit log" page surfaces the table, filtered to the current organisation. Out of scope for this plan; the table just needs to exist by launch.

**Acceptance:**

- Creating, regenerating, and deleting a log source each produces exactly one audit row.
- The row carries the acting user's email and the target source ID.
- The table can be queried by org ID + date range.

### 2.9 — Permissions model

**Why:** Today the controllers use only `MemberOrAbove`/`AdminOrAbove` policies (research-05 §11). Members can see and create log sources; that's correct. But Members must NOT be able to regenerate or delete — those are admin-level destructive actions.

**Implementation:** Already specified inline in §2.3 (`AdminOrAbove`) and §2.4 (`AdminOrAbove`). For the GET endpoints (list + detail), the existing default `ViewerOrAbove` policy is sufficient. For the test-ingest endpoint, `MemberOrAbove` is appropriate (any developer can verify a connection).

Frontend uses `useCurrentUserRole().isAdminOrAbove` to hide the destructive buttons from non-admins. The backend is the source of truth — UI is convenience.

**Acceptance:**

- Member (non-Admin) calling regenerate → 403.
- Member calling delete → 403.
- Member calling test-ingest → 200.
- Admin can do all three.

### 2.10 — Update wizard step 2 to drop dead fields

**Why:** `ProjectLogSourceStep.tsx:39-60` collects "Ingest endpoint URL" (Application), "Log file path" (Infrastructure), "SIEM integration name" (Security), "Integration description" (Custom). None of these are read by the backend. They're saved on the `LogSource.IngestUrl` row and never used. Marketing copy promises (research-05-2 §A.5) an agent/SDK that doesn't exist; these wizard fields are the residue of that promise.

**Implementation:** Simplify the wizard to ask for **name + type only**. The `LogSourceType` enum stays (research-05-2 §A.3: `Application`, `Server`, `Database`, `Network`, `Custom`) — these are display tags, not behavioural switches. The user-typed `endpoint`/`filePath`/etc. fields are removed from the form schema and from the JSX. The `ingestUrl` on the entity is always set server-side to `/api/v1/logs/ingest` (already true at `CreateLogSourceCommand.cs:42`).

Step 3 ("Review") then naturally has nothing surprising to review except the name and type.

After the create mutation succeeds, the wizard opens the §2.2 reveal modal and pushes the user to `/log-sources/{id}` (the §2.6 integration recipe page).

**Acceptance:**

- The wizard's step 2 is one fieldset (type radio) and one input (name).
- No `endpoint`/`filePath`/`siemIntegration`/`customDescription` fields appear.
- After creation, the user lands on the integration recipe page with the modal open.

### 2.11 — Settings → API page (organisation-level overview)

**Why:** Customers want a single page that lists **all** log sources across all projects in their org, with prefixes and last-used timestamps. Drilling into a project to find a key for a different project is annoying.

**Implementation:** New route `src/frontend/src/app/(dashboard)/settings/api/page.tsx`. Server component fetches `GET /api/v1/log-sources?org=current` (new endpoint that returns all sources for the caller's org, joined to project name for display). Renders a table with columns: Project, Source name, Type, Key prefix, Last used, Actions.

This is the page a customer goes to when they Ctrl-F for their key in their notes file and need a quick "which log source is this?" lookup.

Backend addition:

```csharp
// src/backend/StackSift.Application/Queries/LogSources/GetOrganizationLogSourcesQuery.cs — new
public record GetOrganizationLogSourcesQuery() : IRequest<List<LogSourceDto>>;
```

Implementation reuses `ILogSourceRepository` with a new `GetByOrgAsync()` method that ignores the project filter.

**Acceptance:**

- The page lists every log source the org owns.
- Cross-org sources are invisible (org filter in the repo handles this).
- Each row links to the §2.6 integration page.

---

## Verification checklist

- [ ] `LogSources` table contains `KeyHash`, `KeyPrefix`, `KeyLastUsedAt`, `KeyRotatedAt` and no `ApiKey` column after the migration.
- [ ] The pepper config key is documented in `docs/secrets.md` and never committed.
- [ ] `POST /api/v1/projects/{id}/log-sources` returns `LogSourceCreatedDto` (with `apiKey`) exactly once.
- [ ] `GET /api/v1/projects/{id}/log-sources` returns `LogSourceDto[]` (no `apiKey`).
- [ ] `POST /api/v1/log-sources/{id}/regenerate-key` requires Admin, invalidates the old key, returns the new one once.
- [ ] `DELETE /api/v1/log-sources/{id}` requires Admin, soft-deletes, immediately rejects ingestion using the old key.
- [ ] `POST /api/v1/log-sources/{id}/test-ingest` pushes a synthetic event tagged `metadata.synthetic = true`.
- [ ] `LogBatchConsumer` skips rule evaluation for batches where all entries are synthetic.
- [ ] The dashboard wizard never asks for endpoint/filePath/siemIntegration/customDescription.
- [ ] The reveal modal cannot be closed without confirming the key is saved.
- [ ] `/log-sources/{id}` integration page renders curl + Serilog + Winston snippets.
- [ ] Audit log entries appear for every create / regenerate / delete.
- [ ] Member role gets 403 on regenerate and delete; Admin succeeds.
- [ ] Cross-tenant access to any log source endpoint returns 404 (consistent with the project pattern).
- [ ] Existing 209 backend tests still pass; new tests cover §2.3, 2.4, 2.5, 2.7 happy + sad paths.
- [ ] Existing 700+ frontend tests still pass; new tests cover the reveal modal, regenerate confirmation, delete confirmation, integration page tabs.

---

## Out of scope (deferred)

- Per-source IP allowlist (CIDR-based). Reasonable v2 feature; today the API key is the only authentication factor.
- Per-source quota (max events/day). Today only the org-level plan cap exists.
- Time-bound keys (auto-expire). Useful for CI test keys; not launch-blocking.
- Webhook signing for incoming logs (HMAC over body). Stripe-style "X-Signature" header. Worth doing eventually for high-trust customers.
- Full "Settings → Audit log" page UI. The table exists by end of this plan; the UI to browse it can ship after.
