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
| Messaging | RabbitMQ |
| Auth | Keycloak (OIDC/OAuth2) |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16+ (App Router) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS |
| State | TanStack Query v5 |
| Validation | Zod |
| Workspace | pnpm |

### Infrastructure
| Tool | Purpose |
|------|---------|
| Docker Compose | Local development orchestration |
| Kubernetes + Helm | Production deployment |
| Terraform | Cloud IaC |
| Prometheus + Grafana | Metrics & dashboards |
| Uptime Kuma | Uptime monitoring |

---

## 📁 Project Structure

```
StackSift/
├── docs/
│   ├── ai-log.md           # AI Engineering session log
│   └── milestones/         # Capstone deliverables
├── infrastructure/
│   ├── docker/             # Docker Compose configs
│   ├── k8s/                # Helm charts & K8s manifests
│   └── terraform/          # Cloud IaC
├── src/
│   ├── backend/            # .NET 10 Clean Architecture solution
│   ├── frontend/           # Next.js 15 App Router
│   └── shared/             # Shared types / contracts
├── .cursorrules            # Architecture guardrails
├── pnpm-workspace.yaml     # pnpm monorepo config
└── init-stackshift.sh      # Project initialization script
```

---

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- .NET 10 SDK
- Node.js 20+ & pnpm 9+

### 1. Initialize the project
```bash
chmod +x init-stackshift.sh
./init-stackshift.sh
```

### 2. Start the infrastructure
```bash
cd infrastructure/docker
docker compose up -d
```

### 3. Run the backend
```bash
cd src/backend
dotnet run --project StackSift.Api
```

### 4. Run the frontend
```bash
cd src/frontend
pnpm dev
```

### Services (local)
| Service | URL |
|---------|-----|
| API | http://localhost:5000 |
| Frontend | http://localhost:3000 |
| Keycloak | http://localhost:8080 |
| RabbitMQ UI | http://localhost:15672 |
| Grafana | http://localhost:3001 |
| Uptime Kuma | http://localhost:3002 |
| Elasticsearch | http://localhost:9200 |
| Prometheus | http://localhost:9090 |

---

## 🗓️ Capstone Milestones

Course duration: March 23 – June 12, 2026 · 7 milestones · 6 sprints

| Milestone | Weight | Due | Status |
|-----------|--------|-----|--------|
| M1: Product Foundation | 10% | Mar 27 | ✅ Complete |
| M2: Frontend MVP | 15% | Apr 17 | ✅ Complete |
| M3: Backend MVP | 20% | May 8 | 🔄 In Progress |
| M4: Infrastructure & DevOps | 20% | May 22 | ⏳ Upcoming |
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

---

## 📄 Documentation

- [AI Engineering Log](docs/ai-log.md)
- [Architecture Guardrails](.cursorrules)

---

## 📜 License

See [LICENSE](LICENSE)
