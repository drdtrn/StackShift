# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is StackSift

An AI-powered SRE & log-analysis platform. Monorepo with a .NET 10 Clean Architecture backend and Next.js 16 App Router frontend, backed by PostgreSQL+pgvector, Elasticsearch, Redis, RabbitMQ, and Keycloak — all running locally via Docker Compose.

---

## Commands

### Infrastructure
```bash
cd infrastructure/docker && docker compose up -d      # start all 9 services
docker compose down
docker compose logs -f <service>
```

### Backend (.NET 10)
```bash
cd src/backend
dotnet run --project StackSift.Api        # API on http://localhost:5190
dotnet build
dotnet test
dotnet test --filter "FullyQualifiedName~<TestName>"
```

### Frontend (Next.js 16 / pnpm)
```bash
cd src/frontend
pnpm dev                                              # http://localhost:3000
pnpm build
pnpm lint
pnpm test
pnpm test -- src/app/components/ui/Button.test.tsx    # single test file
pnpm test -- --testNamePattern="<regex>"              # single test by name
pnpm test:watch
pnpm test:coverage
pnpm test:e2e                                         # Playwright (configured, not yet written)
```

Offline development: set `NEXT_PUBLIC_AUTH_MOCK=true` in `.env.local` to bypass Keycloak and generate realistic JWTs without Docker.

Auth flow (BFF cookie pattern, realm import, seeded users, smoke-test): see `docs/auth-flow.md`.

---

## Architecture

### Backend — Clean Architecture (strict layer order, no exceptions)
```
Api → Infrastructure → Application → Domain
```
- **Domain** — entities, value objects, repository/service interfaces. Zero external dependencies.
- **Application** — MediatR Commands/Queries, FluentValidation rules. No EF Core or Elasticsearch imports.
- **Infrastructure** — EF Core (PostgreSQL + pgvector), Elasticsearch client, Redis, RabbitMQ adapters. Implements Domain interfaces.
- **Api** — thin ASP.NET controllers: validate params, call `_mediator.Send(command)`, return result. No business logic. Hosts SignalR hubs and Keycloak auth middleware.

### Frontend — Next.js 16 App Router
- **Route groups:** `(auth)` (login, callback, onboarding) and `(dashboard)` (main app) — grouped without affecting URLs.
- **Server state:** TanStack Query v5 for all API data (cursor pagination, retry, cache invalidation).
- **Client state:** Zustand — `useAuthStore` (user/token) and `useUIStore` (sidebar, theme, activeProjectId), both persisted to localStorage.
- **Auth (BFF pattern):** Route handlers in `src/app/api/auth/` proxy to Keycloak using PKCE. Auth state lives in HTTP-only session cookies — no JWT in localStorage.
- **Forms:** React Hook Form + Zod for all form state and runtime schema validation (also validate all API responses with Zod).
- **File placement:** `src/app/components/`, `src/app/hooks/`, `src/app/lib/`, `src/app/types/`.

### Infrastructure services

| Service | Port | Role |
|---|---|---|
| PostgreSQL 16 + pgvector | 5432 | Primary DB + vector embeddings (RAG) |
| Elasticsearch 8.12.0 | 9200 | Log indexing and full-text search |
| Redis | 6379 | Caching + SignalR backplane |
| RabbitMQ 3 | 5672 / 15672 | Async message processing |
| Keycloak | 8080 | Sole identity provider (OAuth2/OIDC) |
| Prometheus | 9090 | Metrics scraping |
| Grafana | 3001 | Dashboards |
| Uptime Kuma | 3002 | Uptime monitoring |

---

## Key Conventions

### Backend
- C# 13 idioms: primary constructors (`public class Handler(IRepo repo)`), collection expressions, nullable reference types enabled.
- Every new API endpoint must have OpenAPI documentation.
- Every EF Core migration must follow the expand/contract policy in `docs/migrations-policy.md`. Destructive operations require an `[Expected: destructive]` marker and an ADR.
- Stripe secrets live in `dotnet user-secrets` (or the prod secret manager) — never in `appsettings.Development.json`. The runbook at `docs/payments.md` lists the four keys.

### Frontend
- **Next.js 16 warning:** Next 16 has breaking changes vs. Next 14/15 (which most training data is anchored to). Before writing Next-specific code (route handlers, middleware, `params`/`searchParams`), read the actual API in `node_modules/next/dist/docs/` or `src/frontend/AGENTS.md`. In particular: `params` and `searchParams` are Promises — always `await` them in async server components.
- `any` is forbidden — enforced by ESLint (`@typescript-eslint/no-explicit-any: error`).
- Tailwind CSS only — no inline styles, no CSS modules unless explicitly justified.
- React Compiler rules forbid reading `ref.current` during render. Use `useState` with a lazy initializer instead: `const [qc] = useState(() => new QueryClient())`.
- TanStack Query v5 `useMutation` requires 4 generic params for optimistic updates: `useMutation<TData, TError, TVars, TContext>`.
- Sign-out sequence: clear Zustand state → invalidate TanStack Query cache → navigate. Order matters to prevent redirect loops.
- Framer Motion props (`initial`, `animate`, etc.) must be stripped in jsdom tests using underscore aliases (`initial: _i`) to prevent DOM prop warnings.

### Git
- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`
- Branch naming: `feature/`, `fix/`, `docs/`, `chore/`
- All PRs must reference a GitHub Issue. No direct commits to `main`.

### Documentation
- Every significant AI-assisted session must be logged in `docs/ai-log.md` (columns: Date, Tool, Prompt Summary, Quality, Time Saved, Lessons).
- Every feature starts with a `docs/ai-log.md` entry before code.
- Every implementation explanation should cover: what was created/modified, why each decision was made, what problem each piece solves, and what would break if removed.

### Security
- Keycloak is the sole Identity Provider. No local JWT generation, even in tests (use `NEXT_PUBLIC_AUTH_MOCK=true` instead).
- All API endpoints must be protected unless explicitly public.
