# StackSift

> **AI-Powered SRE & Log-Analysis Platform**
> Built for the LIFE Fellows AI Engineering Capstone — Cohort 2026

[![.NET](https://img.shields.io/badge/.NET-10.0-purple?logo=dotnet)](https://dotnet.microsoft.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16+-black?logo=nextdotjs)](https://nextjs.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue?logo=docker)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)

### Project Links
| Project | URL |
|---------|-----|
| StackSift - Figma | https://www.figma.com/make/ybDIrt1q4CQcqhjgkHMW70/UI-Mockup-for-StackSift?t=ZAyVpA04Nbu9r2Te-20&fullscreen=1&preview-route=%2Fdashboard |
| StackSift - Trello | https://trello.com/b/5GMXG8Lq/stacksift |

---

## 👥 Team

| Name | Role |
|------|------|
| **Dardan** | DevOps Lead / Fullstack |
| **Jona** | Product Lead / Frontend |
| **Albin** | BackEnd Lead  |

---

## 🧱 Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | .NET 10 / C# 13 |
| Architecture | Clean Architecture (Api → Infrastructure → Application → Domain) |
| CQRS | MediatR |
| Validation | FluentValidation |
| ORM | Entity Framework Core |
| Database | PostgreSQL 16 + pgvector |
| Search | Elasticsearch 8.12 |
| Cache | Redis |
| Messaging | RabbitMQ (MassTransit 9) |
| Real-time | SignalR (Redis backplane) |
| Background Jobs | Hangfire (PostgreSQL) |
| Object Storage | MinIO (S3-compatible) |
| AI | OpenAI (`gpt-4o-mini` + `text-embedding-3-small`) |
| Email | MailKit + Polly retry |
| Logging | Serilog → Loki + OpenTelemetry |
| Testing | xUnit + Testcontainers (Postgres, Keycloak, Redis) |
| Auth | Keycloak (OIDC/OAuth2) |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16+ (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| Server State | TanStack Query v5 |
| Client State | Zustand (persisted) |
| Forms | React Hook Form + Zod |
| Animation | Framer Motion 11 |
| Real-time | `@microsoft/signalr` 8 |
| Validation | Zod (forms + API responses) |
| Testing | Jest + RTL + Playwright |
| Workspace | pnpm |

### Infrastructure
| Tool | Purpose |
|------|---------|
| Docker Compose | Local development orchestration (10 services) |
| Kubernetes + Helm | Production deployment _(planned — M4)_ |
| Terraform | Cloud IaC _(planned — M4)_ |
| Prometheus + Grafana | Metrics & dashboards |
| Loki | Log aggregation (Serilog HTTP sink) |
| Uptime Kuma | Uptime monitoring |

---

## 📁 Project Structure

```
StackSift/
├── docs/
│   ├── ai-log.md                 # AI Engineering session log (42+ entries)
│   ├── ai-rag-architecture.md    # RAG pipeline + system prompt v3
│   ├── sql-optimization.md       # EXPLAIN ANALYZE deep-dive (BE-16)
│   ├── swagger-enrichment.md     # BE-20 OpenAPI walkthrough
│   ├── test-coverage.md          # Testcontainers strategy
│   ├── loki-setup.md             # Loki query guide
│   └── milestones/               # Capstone deliverables
├── infrastructure/
│   ├── docker/                   # Docker Compose configs (10 services)
│   ├── keycloak/                 # Realm export (stacksift-realm.json)
│   ├── k8s/                      # Helm charts & K8s manifests (M4)
│   └── terraform/                # Cloud IaC (M4)
├── src/
│   ├── backend/                  # .NET 10 Clean Architecture solution
│   ├── frontend/                 # Next.js 16+ App Router
│   └── shared/                   # Shared types / contracts
├── zhelpers/                     # Sprint plans, user stories, per-card research/plan
├── .cursorrules                  # Architecture guardrails
├── CLAUDE.md                     # AI coding assistant guidance
├── CURRENTSTATE.md               # Authoritative status snapshot
└── pnpm-workspace.yaml           # pnpm monorepo config
```

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose v2.20+ (`required` env-file syntax)

That's it. The full stack — Postgres, Elasticsearch, Redis, RabbitMQ, Keycloak, MinIO, Mailpit, Prometheus, Loki, Grafana, Uptime-Kuma, the .NET API, the dashboard, and the marketing site — runs in one command.

### 1. Configure local secrets

```bash
cp .env.example .env.local
# edit .env.local and replace every CHANGE_ME (Stripe + OpenAI + Keycloak admin secret)
```

`.env.local` is gitignored. The placeholders work out of the box for everything *except* Stripe (no billing flows) and OpenAI (no AI analyses). The Keycloak admin client secret is needed for the BFF's user-management calls; supply a value once you've imported the realm.

### 2. Bring up the full stack

```bash
cd infrastructure/docker
# Apply schema migrations once (runs to completion, then exits):
docker compose --profile migrate run --rm migrate
# Start everything else:
docker compose up -d --wait
```

The API container no longer runs migrations on start — multi-replica deploys race when each pod calls `MigrateAsync()`. The `migrate` service is opt-in via the `migrate` profile; re-run it before each `docker compose up` after pulling a new commit that touched `Persistence/Migrations/`. (Plan 09 §9.1.)

`--wait` blocks until every service reports healthy (~30 s warm, ~90 s cold). Then:

| Service       | URL                            |
|---------------|--------------------------------|
| Dashboard     | http://localhost:3000          |
| Marketing     | http://localhost:3200          |
| API           | http://localhost:5190          |
| Swagger       | http://localhost:5190/swagger  |
| Keycloak      | http://localhost:8080          |
| Mailpit (UI)  | http://localhost:8025          |
| Grafana       | http://localhost:3001          |
| RabbitMQ (UI) | http://localhost:15672         |

### 3. Hot-reload mode

`infrastructure/docker/docker-compose.override.yml` is auto-merged when you run `docker compose up` from the `infrastructure/docker/` directory. It bind-mounts the source tree and runs `dotnet watch run` + `pnpm dev`:

```bash
cd infrastructure/docker
docker compose up -d              # auto-includes the override
docker compose logs -f api        # watch recompiles
```

To run the production-style stack (image-based, no source mounts — what CI does):

```bash
docker compose -f docker-compose.yml up -d --build
```

### 4. Postgres backup smoke (local)

```bash
cd infrastructure/docker
docker compose --profile pgbackrest-init run --rm pgbackrest-init
# Inspect:
docker compose exec postgres pgbackrest --stanza=stacksift info
```

The init profile creates the stanza in the MinIO repo, runs `pgbackrest check`, then takes the first full backup. Continuous WAL archiving runs automatically once the stanza exists (see `infrastructure/docker/postgres/postgresql.overrides.conf`).

### 5. Stripe billing in dev

```bash
stripe listen --forward-to http://localhost:5190/api/v1/billing/webhook
# copy the printed webhook secret into .env.local → Stripe__WebhookSecret
docker compose restart api
```

> **Offline development without Docker:** set `NEXT_PUBLIC_AUTH_MOCK=true` in `src/frontend/.env.local` to bypass Keycloak and `NEXT_PUBLIC_SIGNALR_MOCK=true` to use an in-memory fake hub. The host-mode commands below still work if you prefer to skip Docker.

### Host-mode fallback (no Docker)

If you'd rather run only the dependencies in Docker and the apps on the host:

```bash
# Dependencies only:
docker compose -f infrastructure/docker/docker-compose.yml \
  up -d postgres redis rabbitmq elasticsearch keycloak minio mailpit

# Backend:
cd src/backend && dotnet run --project StackSift.Api    # :5190

# Frontend (separate terminal):
cd src/frontend && pnpm install && pnpm dev             # :3000

# Marketing (separate terminal):
cd src/marketing && pnpm dev                            # :3200
```

See `docs/payments.md` for the full operator runbook (rotating the webhook secret, adding plans, replaying stuck events).

### Services (local)
| Service | URL |
|---------|-----|
| API | http://localhost:5190 |
| Frontend | http://localhost:3000 |
| Keycloak | http://localhost:8080 |
| RabbitMQ UI | http://localhost:15672 |
| Grafana | http://localhost:3001 |
| Loki | http://localhost:3100 |
| Uptime Kuma | http://localhost:3002 |
| Elasticsearch | http://localhost:9200 |
| Prometheus | http://localhost:9090 |
| MinIO Console | http://localhost:9001 |
| MinIO S3 API | http://localhost:9000 |
| Hangfire Dashboard | http://localhost:5190/hangfire |

---

## 🗓️ Capstone Milestones

Course duration: March 23 – June 12, 2026 · 7 milestones · 6 sprints

| Milestone | Weight | Due | Status |
|-----------|--------|-----|--------|
| M1: Product Foundation | 10% | Mar 27 | ✅ Complete |
| M2: Frontend MVP | 15% | Apr 17 | ✅ Complete |
| M3: Backend MVP | 20% | May 8 | ✅ Complete (tagged `milestone-3`) |
| M4: Infrastructure & DevOps | 20% | May 22 | 🔄 In Progress |
| M5: Fullstack Integration | 15% | May 29 | ⏳ Upcoming |
| M6: Product Analytics | 10% | Jun 5 | ⏳ Upcoming |
| M7: Finalisation & Demo | 10% | Jun 8–12 | ⏳ Upcoming |

### M1: Product Foundation ✅
*Sprint 1 — Weeks 1–2 (due Mar 27)*

- [x] Product Definition Document — problem statement, personas, JTBD, competitive analysis
- [x] MVP Scope & User Story Map — RICE/MoSCoW prioritization, Definition of Done
- [x] Product Backlog — Trello board, all stories estimated and prioritized
- [x] Initial Wireframes — key screens in Figma Make
- [x] Sprint Plan (Sprint 1) — goals, estimates, task assignments
- [x] AI Log Entry #1 — competitive analysis, PRD writing, wireframe generation

### M2: Frontend MVP ✅
*Sprint 2 — Weeks 3–4 (due Apr 17)*

- [x] Next.js 16 App Router scaffolded — TypeScript strict, Tailwind, ESLint + Prettier
- [x] Core UI component library — buttons, inputs, modals, cards, data tables, dark mode
- [x] Routing & layouts — App Router groups, layout/loading/error.tsx, protected routes
- [x] Forms with validation — React Hook Form + Zod, multi-step wizard, file upload
- [x] State management — TanStack Query v5 (server state) + Zustand (client state)
- [x] Frontend tests — Jest + RTL unit/integration, Playwright e2e configured, CI-ready
- [x] Accessibility audit — axe DevTools, all critical violations fixed, keyboard navigation
- [x] Performance baseline — Lighthouse report, Web Vitals, bundle analysis, code splitting
- [x] `.cursorrules` for React monorepo — AI rules configured, productivity measured
- [x] AI Log Entry #2 — component generation, debugging, accessibility fixes

### M3: Backend MVP ✅
*Sprint 3 + early Sprint 4 — Weeks 5–7 (due May 8) — tagged `milestone-3`*

- [x] Clean Architecture solution scaffolded — `Domain`, `Application`, `Infrastructure`, `Api`, `Tests`
- [x] Domain layer — 9 entities, 6 value objects, 8 enums, 4 domain exceptions, repository interfaces
- [x] Application layer — 12 commands, 11 queries, FluentValidation pipeline, MediatR
- [x] Persistence — EF Core + PostgreSQL 16, 4 migrations, soft-delete + audit fields, `UnitOfWork`
- [x] Search — Elasticsearch log indexing (org-scoped `stacksift-logs-{orgId}` indices)
- [x] Caching — Redis cache-aside (`GetDashboardStatsQuery`, 60s TTL)
- [x] Messaging — MassTransit + RabbitMQ (`LogBatchConsumer`, `AlertFiredConsumer`, DLX, retries)
- [x] Real-time — SignalR `AlertHub` with Redis backplane, cross-tenant guard, WebSocket JWT
- [x] Background jobs — Hangfire (`DigestEmailJob`, `LogRetentionJob`, `RunAiAnalysisJob`, `ImmediateAlertEmailJob`)
- [x] AI / RAG pipeline — `gpt-4o-mini` JSON mode + `text-embedding-3-small` + pgvector HNSW cosine top-3
- [x] Object storage — MinIO via S3 SDK, presigned URL rewriting
- [x] Identity — Keycloak realm (`stacksift-api` client, audience/role/org-id mappers)
- [x] API surface — 10 controllers, 24 OpenAPI operations, rate-limited public endpoints
- [x] Middleware — correlation IDs, ProblemDetails exception mapping, API-key auth for log ingest
- [x] Observability — Serilog → Loki sink + OpenTelemetry (ASP.NET + HttpClient instrumentation)
- [x] SQL optimisations — 79× / 5.6× / 76× speed-ups across three hot queries (see [`docs/sql-optimization.md`](docs/sql-optimization.md))
- [x] Integration test suite — Testcontainers (Postgres + Keycloak + Redis), Respawn, `KeycloakTestRealmSeeder`
- [x] AI Log Entry #3 — Sprint 3 + early Sprint 4 documentation

### M4: Infrastructure & DevOps 🔄
*Sprint 5 (M4 track) — Weeks 8–9 (due May 22)*

- [ ] App-image Dockerfiles — multi-stage build for `StackSift.Api` and the Next.js frontend
- [ ] CI workflow — build + test (backend + frontend), publish images on merge to `develop`
- [ ] Helm charts / k8s manifests — stateful services, observability, application tier
- [ ] Terraform — cloud target (Hetzner / DO / etc.), VPC, k8s cluster, secrets
- [ ] Grafana dashboards — four golden signals + Hangfire queue depth + RabbitMQ consumer lag + ES indexing rate
- [ ] OpenTelemetry collector + traces backend (Tempo / Jaeger)
- [ ] Secret management — sealed-secrets / SOPS / external secrets operator
- [ ] Uptime Kuma probes for `/api/v1/health` and the frontend home

### M5: Fullstack Integration ⏳
*Sprint 5 (M5 track) — Week 10 (due May 29)*

- [ ] Frontend test suite triage — restore green baseline (last known good: 450/450 end of Sprint 2)
- [ ] Real `apiClient` wiring — flip the four TanStack Query hooks to hit the backend with Zod boundary validation
- [ ] SignalR real connection — flip `NEXT_PUBLIC_SIGNALR_MOCK=false`, exercise WebSocket JWT
- [ ] Keycloak real PKCE flow — flip `NEXT_PUBLIC_AUTH_MOCK=false`
- [ ] `/incidents/[id]` — the demo-day page (timeline + AI analysis panel + similar past incidents)
- [ ] `/logs` — filter bar + virtualised table + real-time append
- [ ] `/projects`, `/projects/[id]`, `/alerts`, `/settings` — list + detail pages
- [ ] Playwright end-to-end flow — ingest → log appears → alert fires → incident → AI analysis renders

---

## 📄 Documentation

- [AI Engineering Log](docs/ai-log.md)
- [RAG Architecture & System Prompt v3](docs/ai-rag-architecture.md)
- [SQL Optimisations](docs/sql-optimization.md)
- [Test Coverage Strategy](docs/test-coverage.md)
- [Swagger Enrichment Walkthrough](docs/swagger-enrichment.md)
- [Loki Setup](docs/loki-setup.md)
- [Current State Snapshot](CURRENTSTATE.md)
- [Architecture Guardrails](.cursorrules)
- [Claude Code Project Guidance](CLAUDE.md)

---

## 📜 License

See [LICENSE](LICENSE)
