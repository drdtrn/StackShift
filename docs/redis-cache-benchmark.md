# Redis Cache Benchmark — Dashboard Stats Endpoint

**Endpoint:** `GET /api/v1/dashboard/stats`
**Cache key:** `dashboard:stats:{organizationId}`
**TTL:** 60 seconds
**Strategy:** Cache-aside in `GetDashboardStatsQueryHandler`

## What the cold path does

Without a cache hit the handler issues three separate queries:
1. `IAlertRepository.GetActiveCountByOrganizationIdAsync` — PostgreSQL aggregate
2. `ILogEntryRepository.GetTotalTodayByOrganizationIdAsync` — Elasticsearch count query
3. `IIncidentRepository.GetOpenCountByOrganizationIdAsync` — PostgreSQL aggregate

## Benchmark results

> Measured locally with `curl -w "%{time_total}\n" -o /dev/null -s` against `http://localhost:5190/api/v1/dashboard/stats`
> with a valid Keycloak JWT. Docker Compose running on the same machine (no network latency).

| Request | Description | Total time |
|---------|-------------|------------|
| 1st | Cache miss — three DB/ES queries | ~145 ms |
| 2nd | Cache hit — Redis only | ~8 ms |
| 3rd | Cache hit — Redis only | ~6 ms |

**Improvement: ~18× faster on repeat requests.**

## How to reproduce

```bash
# Start all services
cd infrastructure/docker && docker compose up -d

# Obtain a token (replace with a real Keycloak token)
TOKEN="<your-keycloak-jwt>"

# Cold request (cache miss)
curl -w "Cold: %{time_total}s\n" -o /dev/null -s \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:5190/api/v1/dashboard/stats

# Warm request (cache hit — run immediately after)
curl -w "Warm: %{time_total}s\n" -o /dev/null -s \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:5190/api/v1/dashboard/stats

# Verify the key exists in Redis
redis-cli get "dashboard:stats:<org-uuid>"

# Verify TTL
redis-cli ttl "dashboard:stats:<org-uuid>"
```

## Cache invalidation

The cache entry is evicted by `LogBatchConsumer` whenever a new Alert or Incident is created for the organisation:

```csharp
await _cache.RemoveAsync($"dashboard:stats:{organizationId}");
```

This means the dashboard reflects new alerts within one request cycle, not just on TTL expiry.
