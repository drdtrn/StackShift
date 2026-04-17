# StackSift — Copilot Instructions

StackSift is an **AI-Powered SRE & Log-Analysis Platform** — a monorepo with a .NET 10 Clean Architecture backend and a Next.js 15 App Router frontend, backed by PostgreSQL+pgvector, Elasticsearch, Redis, RabbitMQ, and Keycloak running in Docker Compose.

---

## Commands

### Infrastructure
```bash
cd infrastructure/docker && docker compose up -d      # start all 9 services
docker compose down                                   # stop all services
docker compose logs -f <service>                      # tail logs for a service
```

### Backend (.NET 10)
```bash
cd src/backend
dotnet run --project StackSift.Api                   # start API (http://localhost:5190)
dotnet build                                          # build solution
dotnet test                                           # run all tests (once configured)
dotnet test --filter "FullyQualifiedName~<TestName>"  # run a single test
dotnet add <project> package <package>                # add NuGet package
dotnet add <project> reference <other-project>        # add project reference
```

### Frontend (Next.js 15 / pnpm)
```bash
cd src/frontend
pnpm dev                          # start dev server on http://localhost:3000
pnpm build                        # production build
pnpm lint                         # run ESLint across all files
pnpm lint -- --file src/app/page.tsx   # lint a single file
# Tests not yet configured; will use: pnpm test -- <test-file>
```

---

## Architecture

### Layer dependency (strict — no exceptions)
```
Api → Infrastructure → Application → Domain
```
- **Domain** — entities, value objects, repository/service interfaces. Zero infrastructure references.
- **Application** — MediatR Commands & Queries, FluentValidation rules, business orchestration. No EF Core/Elasticsearch imports.
- **Infrastructure** — EF Core DbContext (PostgreSQL + pgvector), Elasticsearch client, Redis, RabbitMQ adapters. Implements Domain interfaces.
- **Api** — thin ASP.NET controllers that dispatch to MediatR. OpenAPI/Swagger, SignalR hubs, Keycloak auth middleware.

### Frontend
All routes live under `src/app/` (App Router). Route groups `(auth)` and `(dashboard)` separate concerns without affecting URLs. TanStack Query v5 owns all server state; React Context for lightweight client state. Zod validates every API response and form input at runtime.

### Infrastructure services

| Service | Port | Role |
|---|---|---|
| PostgreSQL 16 + pgvector | 5432 | Primary DB + vector embeddings for RAG |
| Elasticsearch 8.12.0 | 9200 | Log indexing and full-text search |
| Redis | 6379 | Caching + SignalR backplane |
| RabbitMQ 3 | 5672 / 15672 | Async message processing |
| Keycloak | 8080 | Sole identity provider (OAuth2/OIDC) |
| Prometheus | 9090 | Metrics scraper |
| Grafana | 3001 | Dashboards |
| Uptime Kuma | 3002 | Uptime monitoring |

---

## Key Conventions

### Backend
- **Controllers are thin** — validate route params, call `_mediator.Send(command)`, return result. No business logic.
- **CQRS via MediatR** — every operation is a `Command` (mutation) or `Query` (read) in `StackSift.Application`.
- **FluentValidation** for all input: `RuleFor(x => x.Email).NotEmpty().EmailAddress()`.
- **C# 13 idioms** — primary constructors (`public class Handler(IRepo repo)`), collection expressions (`[item1, item2]`), nullable reference types enabled.
- **No secrets in code** — use environment variables; Keycloak is the only auth path (no local JWT generation, no mock auth).
- Every new API endpoint must have OpenAPI documentation.

### Frontend
- **App Router only** — never use `pages/` directory.
- **TypeScript strict mode is non-negotiable** — no `any`, enforced by ESLint `@typescript-eslint/no-explicit-any`.
- **Tailwind CSS only** — no inline styles, no CSS modules unless explicitly justified.
- **Next.js version warning** — this version has breaking changes vs. common training data. Before writing any Next.js-specific code, check `node_modules/next/dist/docs/` for the actual API.
- File placement: components → `src/app/components/`, hooks → `src/app/hooks/`, utils → `src/app/lib/`, types → `src/app/types/`.

### Git
- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `ci:`
- **Branch naming**: `feature/`, `fix/`, `docs/`, `chore/`
- All PRs must reference a GitHub Issue. No direct commits to `main`.

### Documentation
- Every significant AI-assisted session must be logged in `docs/ai-log.md` (table format: Date, Tool, Prompt Summary, Quality, Time Saved, Lessons).
- Every feature starts with a `docs/ai-log.md` entry before code.
- README must reflect the current architecture and running instructions at all times.

### Explanations
- After every implementation task, provide a deep and detailed explanation of every change made: what was created or modified, why each decision was made, what problem each piece solves, and what would break if it were removed or done differently.
- Never summarise code changes with vague phrases like "added the component" — always explain the reasoning, the trade-offs, and the impact.
