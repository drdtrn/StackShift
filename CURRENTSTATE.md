# StackSift — Current State

**Last updated:** 2026-05-12
**Milestone:** M3 (Backend MVP) — complete
**Branch:** develop

---

## Sprint 3 + Early Sprint 4 — Backend Cards

| Card | Description | Status | PR |
|---|---|---|---|
| BE-01 | Domain layer (entities, interfaces, value objects) | ✅ Done | [#27](https://github.com/drdtrn/StackSift/pull/27) |
| BE-02 | Application layer — CQRS + FluentValidation | ✅ Done | [#28](https://github.com/drdtrn/StackSift/pull/28) |
| BE-03 | EF Core + pgvector migrations | ✅ Done | [#29](https://github.com/drdtrn/StackSift/pull/29) |
| BE-04 | Infrastructure repository layer | ✅ Done | [#30](https://github.com/drdtrn/StackSift/pull/30) |
| BE-05 | Keycloak JWT + 4 RBAC policies | ✅ Done | [#31](https://github.com/drdtrn/StackSift/pull/31) |
| BE-06 | Redis caching | ✅ Done | [#34](https://github.com/drdtrn/StackSift/pull/34) |
| BE-07 | RabbitMQ log ingestion pipeline (MassTransit) | ✅ Done | [#35](https://github.com/drdtrn/StackSift/pull/35) |
| BE-08 | SignalR AlertHub + Redis backplane | ✅ Done | [#36](https://github.com/drdtrn/StackSift/pull/36) |
| BE-09 | Hangfire background jobs | ✅ Done | [#39](https://github.com/drdtrn/StackSift/pull/39) |
| BE-10 | AI RAG endpoint (pgvector + GPT-4o-mini) | ✅ Done | [#42](https://github.com/drdtrn/StackSift/pull/42) |
| BE-11 | MailKit email service + Polly retry + DLQ | ✅ Done | [#37](https://github.com/drdtrn/StackSift/pull/37) |
| BE-12 | 9 API controllers + Swashbuckle | ✅ Done | [#32](https://github.com/drdtrn/StackSift/pull/32) |
| BE-13 | Exception middleware + correlation IDs + Serilog | ✅ Done | [#33](https://github.com/drdtrn/StackSift/pull/33) |
| BE-14 | .NET RateLimiter (3 policies) | ✅ Done | [#38](https://github.com/drdtrn/StackSift/pull/38) |
| BE-15 | File upload — MinIO streaming via AWS SDK S3 | ✅ Done | [#41](https://github.com/drdtrn/StackSift/pull/41) |
| BE-16 | SQL optimization (EXPLAIN ANALYZE × 3 + indexes) | ✅ Done | [#45](https://github.com/drdtrn/StackSift/pull/45) |
| BE-17 | Backend test suite (Testcontainers, no InMemory) | ✅ Done | [#46](https://github.com/drdtrn/StackSift/pull/46) |
| BE-18 | AI Log Entry #3 (Sprint 3 + Early Sprint 4) | ✅ Done | (current PR) |
| BE-19 | Serilog → Loki → Grafana | ✅ Done | [#40](https://github.com/drdtrn/StackSift/pull/40) |
| BE-20 | `.cursorrules` rewrite + AI Swagger enrichment | ✅ Done | [#43](https://github.com/drdtrn/StackSift/pull/43) |

---

## M3 Milestone Checklist (Section 5 Requirements)

| M3 Ref | Requirement | Status | Evidence |
|---|---|---|---|
| M3.4 | SQL optimization proof (EXPLAIN ANALYZE × 3) | ✅ | `docs/sql-optimization.md` |
| M3.9 | File upload (streaming, object storage) | ✅ | `FilesController`, `S3FileStorageService` |
| M3.10 | AI integration (RAG endpoint) | ✅ | `RunAiAnalysisJob`, `OpenAiAnalysisService` |
| M3.11 | Backend tests (xUnit + Testcontainers, no InMemory) | ✅ | `StackSift.Tests/Integration/` |
| M3.13 | Structured logging (Serilog → Loki → Grafana) | ✅ | `docs/loki-setup.md` |
| M3.14 | `.cursorrules` + AI Swagger enrichment | ✅ | `docs/swagger-enrichment.md` |
| M3.15 | AI Log Entry #3 | ✅ | `docs/ai-log.md` |

---

## Supporting Documentation

| Document | Description |
|---|---|
| `docs/ai-log.md` | AI-assisted session log (42 entries, ~125 hrs saved) |
| `docs/sql-optimization.md` | EXPLAIN ANALYZE before/after for 3 queries |
| `docs/swagger-enrichment.md` | AI-assisted Swagger enrichment walkthrough |
| `docs/ai-rag-architecture.md` | RAG pipeline design, prompt template, cost estimate |
| `docs/test-coverage.md` | Test scope, container strategy, coverage by project |
| `docs/loki-setup.md` | Loki + Grafana query guide |
