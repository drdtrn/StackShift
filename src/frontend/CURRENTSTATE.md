# Frontend — Current State

> **Last updated:** 2026-05-19 (FS-03, FS-04, FS-05, FS-07, FS-08)
> **Sprint:** Sprint 5 — M4 + M5 active
> **Health:** Tests green — 69 suites / 621 tests pass (`pnpm test` and `pnpm exec jest --ci`). The earlier "all 66 suites fail to run" symptom was resolved by commit `ee3e50d` on 2026-04-21; FS-01 added a `jest.globalSetup.ts` floor guard to keep it from regressing silently.

---

## Completed Features (Sprint 1 & 2)

| Story | Feature | Status |
|---|---|---|
| FE-01 | Dependencies + tooling (pnpm, Jest, Playwright, ESLint, TypeScript strict) | ✅ Done |
| FE-02 | Tailwind v4 design system — dark mode first, semantic tokens, severity palette | ✅ Done |
| FE-03 | 9 primitive UI components (Button, Badge, Input, Textarea, Card, Skeleton, Spinner, Separator, Tooltip) | ✅ Done |
| FE-04 | 5 data display components (Dropdown, EmptyState, Modal, Toast+ToastContainer, DataTable) | ✅ Done |
| FE-05 | Next.js App Router route structure — 27 files, 2 route groups `(auth)` / `(dashboard)` | ✅ Done |
| FE-06 | State management — TanStack Query v5 + Zustand stores + mock data + query hooks | ✅ Done |
| FE-08 | Performance baseline — Lighthouse, bundle analysis, code splitting | ✅ Done |
| US-01 | Google SSO auth via BFF pattern (Keycloak PKCE, HTTP-only session cookies) | ✅ Done |
| US-02 | Sign-out (Zustand clear → TanStack Query clear → Keycloak logout) | ✅ Done |
| US-03 | Onboarding — Create Organisation multi-step form | ✅ Done |
| US-04 | Dashboard empty state + metric cards (Active Alerts, Total Logs, Open Incidents) | ✅ Done |
| US-05 | App Shell Layout — Sidebar (collapse/expand), mobile drawer, Framer Motion | ✅ Done |
| US-06 | TopBar — Breadcrumb, NotificationBell, OrgSwitcher, ThemeToggle, UserAvatarMenu | ✅ Done |
| US-07 | Dark mode — anti-FOUC inline script, semantic token sweep, full theme switching | ✅ Done |
| US-08 | Multi-step forms — New Project Wizard + Alert Rule Builder (RHF + Zod + discriminatedUnion) | ✅ Done |
| US-09 | SignalR real-time — Live Log Stream + Alert Toasts (mock mode with `NEXT_PUBLIC_SIGNALR_MOCK=true`) | ✅ Done |

---

## Page Routes

| Route | File | State |
|---|---|---|
| `/login` | `(auth)/login/page.tsx` | ✅ Full — Google SSO via `/api/auth/login` |
| `/callback` | `(auth)/callback/page.tsx` | ✅ Full — PKCE callback handler |
| `/onboarding` | `(auth)/onboarding/page.tsx` | ✅ Full — Create org form |
| `/` | `(dashboard)/page.tsx` | ✅ Full — Metric cards + empty state |
| `/logs` | `(dashboard)/logs/page.tsx` | ✅ Full — filter bar + virtualised table + cursor pagination + appendLog seam (FS-07) |
| `/incidents` | `(dashboard)/incidents/page.tsx` | ✅ Full — status filter tabs + paginated table (FS-05) |
| `/incidents/[id]` | `(dashboard)/incidents/[id]/page.tsx` | ✅ Full — IncidentHeader, AlertsTimeline, AiAnalysisPanel, SimilarIncidents (FS-05) |
| `/alerts` | `(dashboard)/alerts/page.tsx` | 🔲 Stub — awaiting BE |
| `/alerts/new` | `(dashboard)/alerts/new/page.tsx` | ✅ Alert Rule Builder wizard (mock POST) |
| `/projects` | `(dashboard)/projects/page.tsx` | ✅ Full — project cards, empty/skeleton/error states (FS-04) |
| `/projects/new` | `(dashboard)/projects/new/page.tsx` | ✅ New Project wizard — now POSTs to real backend (FS-04) |
| `/projects/[id]` | `(dashboard)/projects/[id]/page.tsx` | ✅ Full — project header, log sources list (FS-04) |
| `/settings` | `(dashboard)/settings/page.tsx` | 🔲 Stub |

---

## Key Files

| File | Purpose |
|---|---|
| `src/app/types/domain.ts` | **Authoritative FE type contract** — all 9 entities + 7 enums. Backend JSON must match exactly |
| `src/app/types/api.ts` | Response envelopes + Zod schemas for runtime validation |
| `src/app/lib/api-client.ts` | Hardened Axios instance — bearer from `/api/auth/bearer` (not localStorage), per-call Zod validation, 401 silent-refresh, correlation ID on toasts |
| `src/app/lib/api-schemas.ts` | **All** domain Zod schemas (9 entities + enums + envelope factories + ApiErrorSchema) |
| `src/app/api/auth/bearer/route.ts` | Server-side route returning `{ token }` from HTTP-only session cookie; handles refresh |
| `src/app/hooks/useApiError.ts` | Toast helper — formats ApiSchemaError (dev: ZodError path, prod: "unavailable"), AxiosError, unknown errors |
| `src/app/hooks/queries/use-projects.ts` | Real API — `GET /api/v1/projects` (list) + `GET /api/v1/projects/{id}` (single) |
| `src/app/hooks/queries/use-project-log-sources.ts` | Real API — `GET /api/v1/projects/{id}/log-sources` |
| `src/app/hooks/mutations/use-create-project.ts` | Real API — `POST /api/v1/projects` with 4-generic optimistic update |
| `src/app/(dashboard)/projects/_components/ProjectCard.tsx` | Project card with color dot, counts, link to detail |
| `src/app/(dashboard)/projects/_components/ProjectsList.tsx` | Client component — data-fetching + skeleton + empty state |
| `src/app/(dashboard)/projects/[id]/_components/ProjectDetailView.tsx` | Client component — project header + log sources list |
| `src/app/lib/mock-data.ts` | All mock data used by query hooks while backend doesn't exist |
| `src/app/lib/signalr-config.ts` | Hub URL (`NEXT_PUBLIC_SIGNALR_HUB_URL`), method name constants |
| `src/app/lib/signalr-mock.ts` | Mock hub that emits random LogEntry/Alert events every 2–5s |
| `src/app/lib/auth/config.ts` | Keycloak URLs, realm, client_id, cookie names |
| `src/app/lib/auth/session.ts` | Session cookie read/write helpers |
| `src/app/hooks/useAuthStore.ts` | Zustand — user, token, isAuthenticated |
| `src/app/hooks/useUIStore.ts` | Zustand — sidebar state, theme, activeProjectId (persisted) |
| `src/app/hooks/queries/use-logs.ts` | Real API — `useInfiniteQuery` cursor-paginated `GET /api/v1/logs`; `useLogEntry` single; `useLogAppend` FS-09 seam |
| `src/app/lib/time-presets.ts` | Time-range preset helpers (15m/1h/6h/24h/7d) — used by `LogFilterBar` |
| `src/app/(dashboard)/logs/_components/LogsView.tsx` | Client shell — owns filter state, URL sync via `useSearchParams` + `router.replace` |
| `src/app/(dashboard)/logs/_components/LogFilterBar.tsx` | Filter bar — time presets, severity multi-select, project select, debounced search (300ms) |
| `src/app/(dashboard)/logs/_components/LogTable.tsx` | Virtualised table via `@tanstack/react-virtual`; infinite scroll at 500px from bottom; empty + skeleton states |
| `src/app/(dashboard)/logs/_components/LogTableRow.tsx` | Log row — relative timestamp (absolute on hover), level badge, service, truncated message (expand on click), copy traceId |
| `src/app/hooks/queries/use-incidents.ts` | Real API — `useIncidents` (paginated list), `useIncident` (single), `useIncidentAlerts` (alerts by incident) |
| `src/app/hooks/mutations/use-update-incident-status.ts` | PATCH `/api/v1/incidents/{id}/status` with optimistic update + rollback (FS-05) |
| `src/app/hooks/queries/use-similar-incidents.ts` | GET `/api/v1/incidents/{id}/similar` → `SimilarIncident[]` (cosine similarity, staleTime 60s) |
| `src/app/(dashboard)/incidents/_components/IncidentsView.tsx` | Client shell — status filter tabs, paginated incident table, STATUS_VARIANT/SEVERITY_VARIANT maps |
| `src/app/(dashboard)/incidents/[id]/_components/IncidentDetailView.tsx` | Client shell — orchestrates all 4 detail panels; handles loading/not-found states |
| `src/app/(dashboard)/incidents/[id]/_components/IncidentHeader.tsx` | Status/severity badges, action buttons (Acknowledge/Resolve/Close), status transition guard |
| `src/app/(dashboard)/incidents/[id]/_components/AlertsTimeline.tsx` | Sorted alerts with timeline dot, severity badge, ack indicator |
| `src/app/(dashboard)/incidents/[id]/_components/AiAnalysisPanel.tsx` | State machine: idle→triggering→pending→processing→completed/failed; ProgressText cycles 4 steps |
| `src/app/(dashboard)/incidents/[id]/_components/SimilarIncidents.tsx` | Top-3 similar incidents by cosine score; coloured percentage display |
| `src/app/hooks/queries/` | TanStack Query hooks — alerts still use mock data; logs/projects/dashboard/ai/incidents call real backend |
| `src/app/hooks/mutations/use-trigger-ai-analysis.ts` | POST `/api/v1/incidents/{id}/analyze` → 202; seeds the aiAnalyses cache and 429s into a plan-cap warning toast |
| `src/app/components/providers/AuthGuard.tsx` | Redirects unauthenticated users to `/login?next=...` |
| `src/app/components/providers/OnboardingGuard.tsx` | Redirects users with `organizationId: null` to `/onboarding` |

---

## API Contract (What Backend Must Return)

### Response envelopes

```typescript
ApiResponse<T>          → { data: T, success: boolean, message: string | null }
PaginatedResponse<T>    → { data: T[], total: number, page: number, pageSize: number, hasNextPage: boolean, hasPreviousPage: boolean }
CursorPaginatedResponse → { data: T[], nextCursor: string | null, hasMore: boolean }
ApiError (ProblemDetails) → { type, title, status, detail, traceId, errors: Record<string, string[]> | null }
```

### Entity field names (camelCase — must match `types/domain.ts` exactly)

```
Organization:  id, name, slug, logoUrl, createdAt, updatedAt
Project:       id, organizationId, name, slug, description, color, createdAt, updatedAt, logSourceCount, activeIncidentCount
LogSource:     id, projectId, name, type, ingestUrl, apiKey, isActive, lastSeenAt, createdAt
LogEntry:      id, projectId, logSourceId, level, message, timestamp, traceId, spanId, serviceName, hostName, metadata
AlertRule:     id, projectId, name, condition, threshold, windowMinutes, logLevel, pattern, isActive, createdAt, updatedAt
Alert:         id, projectId, alertRuleId, severity, title, description, firedAt, acknowledgedAt, resolvedAt, incidentId
Incident:      id, projectId, status, title, description, severity, startedAt, acknowledgedAt, resolvedAt, closedAt, assigneeId, alertIds, aiAnalysisId
AiAnalysis:    id, incidentId, status, summary, rootCause, suggestedFixes[], relevantLogIds[], confidenceScore, createdAt, completedAt
User:          id, email, displayName, avatarUrl, role, organizationId, createdAt, lastLoginAt
DashboardStats: activeAlertCount, totalLogsToday, openIncidentCount
```

### Enum string values (must match exactly)

```
LogLevel:            trace | debug | info | warning | error | critical
AlertSeverity:       low | medium | high | critical
IncidentStatus:      open | acknowledged | resolved | closed
UserRole:            owner | admin | member | viewer
LogSourceType:       application | server | database | network | custom
AlertRuleCondition:  threshold | anomaly | pattern | absence
AiAnalysisStatus:    pending | processing | completed | failed
```

### SignalR hub

- URL: `http://localhost:5190/hubs/stacksift`
- Method `ReceiveLogEntry` → pushes `LogEntry` shape
- Method `ReceiveAlert` → pushes `Alert` shape

---

## Environment Variables

| Variable | Purpose | Dev default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL | `http://localhost:5190` |
| `NEXT_PUBLIC_APP_URL` | Frontend base URL (OIDC redirect) | `http://localhost:3000` |
| `NEXT_PUBLIC_KEYCLOAK_URL` | Keycloak server | `http://localhost:8080` |
| `NEXT_PUBLIC_KEYCLOAK_REALM` | Keycloak realm | `stacksift` |
| `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` | OIDC client | `stacksift-frontend` |
| `NEXT_PUBLIC_AUTH_MOCK` | Bypass Keycloak entirely | `true` |
| `NEXT_PUBLIC_AUTH_MOCK_NEW_USER` | Mock login returns user with no org | `false` |
| `NEXT_PUBLIC_SIGNALR_MOCK` | Use fake SignalR hub | `true` |
| `NEXT_PUBLIC_SIGNALR_HUB_URL` | Real hub URL | `http://localhost:5190/hubs/stacksift` |

---

## Pending Work (Sprint 3+)

- [x] **FS-03 — Hardened apiClient + Zod boundary** — bearer cookie route, `api-schemas.ts`, schema interceptor, 401 retry, `useApiError` hook. 66 suites / 607 tests green.
- [x] **FS-04 — Projects integration** — `useProjects`, `useProject`, `useProjectLogSources` call real BE. `useCreateProject` POSTs to BE with optimistic update. Mock route deleted. `/projects` and `/projects/[id]` fully wired.
- [x] **FS-08 — Dashboard + AI analysis integration** — `useDashboardStats`, `useAiAnalysis` (poll fallback), `useTriggerAiAnalysis` (with plan-cap 429 toast); dashboard page rewritten to consume the single stats hook; fixed `DashboardStatsSchema` field-name drift. 69 suites / 621 tests green (post FS-04 merge).
- [x] **FS-07 — Logs integration** — `useLogEntries` rewritten as `useInfiniteQuery` (cursor pagination), `useLogAppend` FS-09 seam, `LogFilterBar` (time presets / severity multi-select / project / debounced search), `LogTable` virtualised with `@tanstack/react-virtual`, `LogTableRow` (expand + copy traceId). 68 suites / 615 tests green.
- [x] **FS-05 — Incidents integration** — `useIncidents`/`useIncident`/`useIncidentAlerts` call real BE; `useUpdateIncidentStatus` (optimistic, rollback); `useSimilarIncidents`; `/incidents` list with status filter tabs + pagination; `/incidents/[id]` with 4-panel layout (Header, AlertsTimeline, AiAnalysisPanel, SimilarIncidents). 69 suites / 621 tests green.
- [ ] **Replace remaining mock TanStack Query hooks** (alerts) with real `apiClient` calls — FS-06
- [ ] **Wire real SignalR** — set `NEXT_PUBLIC_SIGNALR_MOCK=false`, point to real AlertHub; consume `useLogAppend` in FS-09
- [x] **Incident Detail page** (`/incidents/[id]`) — done in FS-05
- [x] **Project Detail page** (`/projects/[id]`) — log sources list (FS-04)
- [ ] **Alerts list page** (`/alerts`) — active alerts table
- [x] **Projects list page** (`/projects`) — project cards (FS-04)
- [ ] **Settings page** (`/settings`) — org settings, members
- [ ] **Playwright e2e tests** — at least one complete user flow (configured, not yet written)
- [ ] **Accessibility audit** — axe DevTools, M2.7 deliverable
- [x] **Fix test runner** — resolved 2026-04-21 (`ee3e50d`); verified 2026-05-18 at 66 suites / 598 tests. Floor enforced via `jest.globalSetup.ts` (FS-01).

---

## Known Constraints & Gotchas

- **Next.js 15 breaking change:** `params` and `searchParams` are Promises — always `await params` in async server components
- **`any` is forbidden** — `@typescript-eslint/no-explicit-any: error` enforced
- **React Compiler:** no `ref.current` during render; use `useState(() => ...)` lazy initializer instead
- **Framer Motion in jsdom tests:** strip `initial/animate/exit/transition` props with underscore-alias pattern (`initial: _i`)
- **Dark mode:** uses `@custom-variant dark (&:where(.dark, .dark *))` in `globals.css` — NOT `darkMode: 'class'` in config
- **Sign-out order:** Zustand clear → TanStack Query clear → `window.location.href = '/api/auth/logout'` (must use `window.location`, not `router.push`)
- **`await queryClient.invalidateQueries()`** before `router.push()` in mutations that update auth-gated data — prevents infinite redirect loops
- **apiClient bearer token** is fetched from `/api/auth/bearer` (server-side, reads HTTP-only cookie) and cached 55 s in memory. Call `invalidateBearerCache()` if you need to force a fresh fetch.
- **Per-call schema validation:** pass `schema: SomeZodSchema` in the Axios config object to get Zod-parsed response data back; failures throw `ApiSchemaError`.
- **404 responses** are NOT globally toasted — the calling component is responsible for rendering an empty/not-found state.
- **Mock `src/app/api/projects/route.ts` deleted** — do not recreate; `useCreateProject` now hits `POST /api/v1/projects` on the real backend.
- **Project color** arrives from the backend as a hex string (`#3b82f6`) — do NOT use Tailwind class names like `blue-500`; set via `style={{ backgroundColor: project.color }}`.
- **`queryKeys.logSources`** added — use `queryKeys.logSources.byProject(projectId)` for log source queries.
- **`useInfiniteQuery` generic in v5** returns `UseInfiniteQueryResult<InfiniteData<TData>, TError>`, NOT `<TData, TError>` — use `InfiniteData<T>` in component prop types and access `data.pages.flatMap(p => p.data)` to get a flat row array.
- **`LogQueryFilters.levels`** (`LogLevel[]`) added for multi-select severity — serialised as repeated `level` params by Axios; takes priority over the single `level` field.
- **`LogsView` uses `useSearchParams`** — requires a `<Suspense>` boundary in the parent server component or Next.js will throw a dynamic rendering error.
- **`useLogAppend(filters)`** is the FS-09 seam — pass current filter state, call returned fn with a `LogEntry` on each SignalR event. Deduplicates by `id`.
- **`SimilarIncident`** shape: `{ incident: Incident, score: number }` where `score` is cosine similarity 0–1; UI shows `Math.round(score * 100)%`.
- **`useUpdateIncidentStatus` transition guard:** Open→Acknowledged→Resolved→Closed enforced on client (button disabled/hidden) AND server (422 on invalid transition).
- **`useIncidentAlerts` workaround:** incident DTOs carry only `alertIds: string[]`; this hook fetches `GET /api/v1/alerts?incidentId=...` as a workaround.
- **AI Analysis polling:** `useAiAnalysis` polls every 5s while `status` is `pending` or `processing`; stops (returns `false`) when `completed` or `failed`.
- **Tailwind v4 `@theme` aliases** must mirror the exact utility class names used in components — a missing alias causes silent no-color rendering
