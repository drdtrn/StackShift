# AI RAG Architecture

## Pipeline

```
POST /api/v1/incidents/{id}/analyze
   → TriggerAiAnalysisCommandHandler (Application)
      - Creates AiAnalysis row (Status=Pending)
      - Enqueues RunAiAnalysisJob via IAiAnalysisJobRunner
      - Returns 202 Accepted + AiAnalysisDto + Location header

Hangfire: RunAiAnalysisJob.ExecuteAsync(analysisId)
   1. Load analysis + incident from Postgres (AppDbContext directly — no org filter)
   2. Guard: already Completed → no-op; no API key → Status=Failed
   3. Set Status=Processing
   4. Search ±5 min logs from Elasticsearch (org-scoped index: stacksift-logs-{orgId})
   5. Embed concatenated logs with text-embedding-3-small (1536-d)
   6. Save Embedding + RelevantLogIds to Postgres
   7. Top-3 cosine similarity over Completed past analyses (raw SQL, HNSW index)
   8. Build prompt: current incident + similar past incidents
   9. Call gpt-4o-mini (response_format=json_object, max_tokens=1000, temperature=0)
   10. Parse response → Summary / RootCause / SuggestedFixes / ConfidenceScore
   11. Set Status=Completed, save to Postgres
   12. Broadcast AiAnalysisDto via SignalR (project-{projectId} group)

GET /api/v1/ai-analyses/{id}
   → GetAiAnalysisByIdQueryHandler — polling fallback when SignalR unavailable
```

## Model Choice

| Model | Role | Dimensions | Cost |
|---|---|---|---|
| text-embedding-3-small | Embed log context | 1536-d | $0.020/1M tokens |
| gpt-4o-mini | Root-cause analysis | — | $0.15/$0.60 per 1M in/out |

## Cost Estimate (per analysis)

- Embedding: ~32k chars ≈ 8k tokens → **$0.00016**
- Chat: ~3k input + ~500 output → **$0.0008**
- **Total ≈ $0.001** — well under the $0.005–0.02 envelope

## Latency Target

P95 ≤ 15 s:
- Embedding: ~500 ms
- HNSW similarity search: ~50 ms
- gpt-4o-mini chat: ~6–10 s
- SignalR push via Redis backplane: <100 ms

## Vector Storage

- Column: `AiAnalyses.Embedding vector(1536)` (Postgres pgvector)
- Index: `IX_AiAnalyses_Embedding_cosine` — HNSW (`m=16, ef_construction=64`)
- HNSW chosen over IVFFlat: usable from row #1, higher recall, no per-cluster tuning needed

## System Prompt (v3)

```
You are StackSift's incident-analysis assistant. You help engineers diagnose the root
cause of production incidents from raw log lines and from prior resolved incidents in
the same project.

You will receive:
- The current incident's title, start time, and a concatenated log context.
- Up to 3 past incidents in the SAME organisation that have been resolved, with each
  one's previous summary, root cause, and suggested fixes.

Output STRICT JSON with this exact shape — no prose, no markdown, no code fences:
{
  "summary": "<1-3 sentence explanation of what happened>",
  "rootCause": "<the most likely root cause, in plain English, naming specific
                components / files / line numbers if visible in the logs>",
  "suggestedFixes": ["<actionable fix 1>", "<actionable fix 2>", ...],
  "confidenceScore": <number from 0.0 to 1.0>
}

Rules:
- If the logs are insufficient for a root cause, say so honestly in `rootCause` and
  give a low `confidenceScore` (<= 0.3).
- Reference past similar incidents when they help; if a past fix was a workaround
  rather than a root-cause fix, say so.
- Each suggestedFixes entry should be ONE concrete action (config change, code fix,
  ops command). No multi-step paragraphs. 1-5 entries.
- Do not invent file paths, line numbers, or version numbers that aren't in the logs.
- confidenceScore is your honest self-assessment. 0.9 means "highly likely correct";
  0.3 means "speculative".
```

## Failure Modes

| Failure | Behaviour |
|---|---|
| Missing API key | Fast-fail → Status=Failed, summary="OpenAI API key not configured" |
| gpt-4o-mini returns non-JSON | AiAnalysisException → Status=Failed, no Hangfire retry |
| Missing rootCause field | AiAnalysisException → Status=Failed |
| HTTP 429/503 from OpenAI | Rethrows → Hangfire retries at 30s, 120s, 300s, 600s, 1800s |
| ES index missing (no logs) | Graceful — proceeds with empty log context, low confidence |
| Similarity search unavailable | Graceful — proceeds without RAG context, logs warning |
| Hangfire re-run (retry) | Idempotency gate: Completed status → no-op |

## Architectural Notes

- **Hangfire jobs bypass org-scoped repos**: `AppDbContext` is used directly (same pattern as
  `LogBatchConsumer`). The ES log search uses the incident's `OrganizationId` directly to form
  the index name (`stacksift-logs-{orgId}`), avoiding the HTTP-context dependency.
- **Application→Infrastructure soft reference**: `TriggerAiAnalysisCommandHandler` injects
  `IAiAnalysisJobRunner` (Application interface). `HangfireAiAnalysisJobRunner` (Infrastructure)
  implements it — preserving Clean Architecture while allowing Hangfire enqueue.
- **Thin SDK wrappers**: `IChatCompleter` and `IEmbedder` wrap the sealed `ChatClient` and
  `EmbeddingClient` SDK classes, enabling Moq-based unit testing without live API calls.
