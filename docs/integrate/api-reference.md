# StackSift Ingestion API Reference

The single source of truth for log ingestion. SDKs (`StackSift.Serilog.Sink`, `@stacksift/winston-transport`) derive from this document; any change to the request or response shape must update this file in the same PR (enforced by CODEOWNERS on `src/backend/StackSift.Application/Commands/Logs/IngestLogBatchCommand.cs` and `src/backend/StackSift.Application/DTOs/IngestLogEntryDto.cs`).

**Base URL (production):** `https://api.stacksift.com` (TBD — replace at launch)
**Base URL (local development):** `http://localhost:5190`
**Endpoint:** `POST /api/v1/logs/ingest`

---

## Authentication

One of:

- `Authorization: Bearer <jwt>` — Keycloak access token. Used by the dashboard.
- `X-Api-Key: <key>` — log-source API key. Used by SDKs and any direct HTTP integration.

Keys are 32-byte base64url strings prefixed with `ss_`, e.g. `ss_AbCdEf12...` (43 chars after the prefix). Generated when a log source is created or its key is regenerated; revealed exactly once in the dashboard. Treat them as bearer secrets — never log the full key, never commit them to source control. The first 8 chars (`ss_AbCd`) are safe to log for debugging.

If both headers are present, the JWT is preferred.

---

## Request

```http
POST /api/v1/logs/ingest HTTP/1.1
Host: api.stacksift.com
X-Api-Key: ss_AbCdEf12...
Content-Type: application/json
```

```json
{
  "projectId": "11111111-1111-1111-1111-111111111111",
  "logSourceId": "22222222-2222-2222-2222-222222222222",
  "entries": [
    {
      "level": "Error",
      "message": "Checkout failed for user u_42",
      "timestamp": "2026-05-28T14:32:01.123+00:00",
      "traceId": "1a2b3c4d5e6f7a8b",
      "spanId": "9c8d7e6f",
      "serviceName": "checkout-svc",
      "hostName": "pod-checkout-7d9f8",
      "metadata": {
        "orderId": "o_99",
        "userId": "u_42",
        "amount": 49.99
      }
    }
  ]
}
```

### Top-level fields

| Field         | Type             | Required | Notes                                          |
|---------------|------------------|----------|------------------------------------------------|
| `projectId`   | UUID             | yes      | From the dashboard. Must belong to the key's org. |
| `logSourceId` | UUID             | yes      | From the dashboard. Must belong to the key's org. |
| `entries`     | array (1…1000)   | yes      | At least 1 entry; at most 1000 per batch.       |

### Entry fields

| Field         | Type                                                | Required |
|---------------|-----------------------------------------------------|----------|
| `level`       | enum: `Trace`, `Debug`, `Info`, `Warning`, `Error`, `Critical` | yes |
| `message`     | string                                              | yes      |
| `timestamp`   | ISO 8601 datetime with offset (RFC 3339)            | yes      |
| `traceId`     | string                                              | no       |
| `spanId`      | string                                              | no       |
| `serviceName` | string                                              | no       |
| `hostName`    | string                                              | no       |
| `metadata`    | JSON object, max ~64 KB after serialisation         | no       |

`metadata` is stored verbatim in Elasticsearch. Keep keys and values bounded — values larger than ~64 KB are rejected at the indexing layer.

---

## Limits

- **Batch size:** ≤ 1000 entries.
- **Body size:** 1 MB after JSON serialisation (Kestrel default).
- **Rate limit:** 100 batches per 60 seconds **per API key**. Falls back to per-IP partitioning when the key header is absent.
- **Entry timestamp drift:** there is no hard rejection on past/future timestamps. Out-of-order ingestion is supported; cursor pagination is timestamp + id stable.

---

## Response

`202 Accepted` with an empty body. Logs are queued via RabbitMQ and indexed asynchronously by `LogBatchConsumer`. Typical p99 from accept to "visible in dashboard live tail" is < 1 second.

The 202 means *queued*, not *indexed*. Failures during indexing surface as backend errors visible on the dashboard's health endpoint, not on this response. If an SDK retries on 202, it will create duplicates — don't.

---

## Error responses

All errors follow RFC 7807 `application/problem+json`:

```json
{
  "type": "https://stacksift.com/problems/validation",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "errors": {
    "Entries": ["Batch size cannot exceed 1000 entries."]
  }
}
```

| Status | When                                                              | SDK behaviour                            |
|--------|-------------------------------------------------------------------|------------------------------------------|
| 400    | Validation failure (missing IDs, > 1000 entries, malformed body). | Drop the batch; surface to caller.       |
| 401    | Missing key, malformed key, or key revoked.                        | Drop the batch; surface to caller.       |
| 403    | Key valid but log source inactive (soft-deleted or regenerated).  | Drop the batch; surface to caller.       |
| 404    | `projectId` or `logSourceId` not in the key's organisation.        | Drop the batch; surface to caller.       |
| 429    | Rate limit exceeded for this key.                                  | Honour `Retry-After`, then retry.        |
| 5xx    | Transient backend / dependency failure.                            | Retry with exponential backoff (capped). |

The `Retry-After` header on 429 is an integer number of seconds.

---

## Idempotency

The endpoint is **not** idempotent — two identical requests produce two log entries in Elasticsearch (different `id` per entry). If an SDK retries a request after a network failure where the server may have already accepted, it will produce duplicates. Most SDKs accept this trade-off; deduplication on the StackSift side would require a request-ID header and a Redis cache, which is on the roadmap but not v1.

---

## Versioning

The endpoint is versioned in its path (`/api/v1/...`). Backward-incompatible changes get a new version path; backward-compatible additions (new optional entry fields, new error subtypes) ship on the same path.

The SDK versioning policy that governs how additions propagate to consumers is in [sdk-versioning.md](./sdk-versioning.md).

---

## Internal references (for maintainers)

- Controller: `src/backend/StackSift.Api/Controllers/LogEntriesController.cs:62-72`
- Command + validator: `src/backend/StackSift.Application/Commands/Logs/IngestLogBatchCommand.cs:12-28`
- Entry DTO: `src/backend/StackSift.Application/DTOs/IngestLogEntryDto.cs:5-14`
- Level enum: `src/backend/StackSift.Domain/Enums/LogLevel.cs`
- API-key middleware: `src/backend/StackSift.Api/Middleware/ApiKeyAuthMiddleware.cs`
- Rate-limit policy: `src/backend/StackSift.Api/Program.cs:165-177`
- Async consumer: `src/backend/StackSift.Infrastructure/Messaging/Consumers/LogBatchConsumer.cs`
