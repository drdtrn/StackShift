# SQL Optimization — BE-16

**Dataset:** 5 organisations · 50 projects · 100 log sources · ~50 000 incidents · ~200 000 alerts  
**Tool:** `EXPLAIN (ANALYZE, BUFFERS)` against PostgreSQL 16 + pgvector  
**Migration:** `20260509000001_AddPerformanceIndexes`

---

## Summary

| Query | Before (ms) | After (ms) | Improvement |
|-------|------------|-----------|------------|
| Incident pagination (`GetByProjectIdAsync`) | 34.9 ms | 0.44 ms | **98.7% faster (79×)** |
| Active alert count (`GetActiveCountByOrganizationIdAsync`) | 104.5 ms | 18.8 ms | **82% faster (5.6×)** |
| Projects with counts (N+1 → single query) | ~458 ms / 21 queries | 6.0 ms / 1 query | **98.7% faster (76×)** |

---

## Query 1 — Incident Pagination with Status Filter

**Source:** `IncidentRepository.GetByProjectIdAsync(projectId, page, pageSize, status)`

### LINQ

```csharp
BaseQuery
    .Where(i => i.ProjectId == projectId && i.Status == status)
    .OrderByDescending(i => i.StartedAt)
    .Skip((page - 1) * pageSize)
    .Take(pageSize)
    .ToListAsync(ct);
```

### Generated SQL (simplified)

```sql
SELECT * FROM "Incidents"
WHERE "OrganizationId" = @orgId
  AND "ProjectId"      = @projectId
  AND "IsDeleted"      = false
  AND "Status"         = @status
ORDER BY "StartedAt" DESC
LIMIT @pageSize OFFSET @offset;
```

### Before plan

```
Limit  (cost=2021.83..2021.88 rows=20 width=128) (actual time=34.771..34.778 rows=20 loops=1)
  Buffers: shared hit=1674
  ->  Sort  (cost=2013.66..2013.78 rows=49 width=128) (actual time=34.769..34.772 rows=20 loops=1)
        Sort Key: i."StartedAt" DESC
        Sort Method: top-N heapsort  Memory: 30kB
        ->  Bitmap Heap Scan on "Incidents" i  (cost=138.22..2012.35 rows=49 width=128) (actual time=2.752..34.591 rows=250 loops=1)
              Recheck Cond: ("Status" = 'Open'::text)
              Filter: ((NOT "IsDeleted") AND ("OrganizationId" = ...) AND ("ProjectId" = $0))
              Rows Removed by Filter: 12250
              Heap Blocks: exact=1655
              Buffers: shared hit=1671
              ->  Bitmap Index Scan on "IX_Incidents_Status"  (cost=0.00..138.20 rows=12522 width=0) (actual time=2.204..2.204 rows=12500 loops=1)
                    Index Cond: ("Status" = 'Open'::text)
                    Buffers: shared hit=11
Planning Time: 2.141 ms
Execution Time: 34.915 ms
```

**Before cost:** `cost=2021.83` | **Execution time:** 34.9 ms | **Rows scanned:** 12 500 (12 250 discarded)  
**Diagnosis:** The planner used the single-column `IX_Incidents_Status` index to find all 12 500 `Open` rows across the entire table, then filtered by `OrganizationId` and `ProjectId` in the heap — discarding 98% of the rows fetched.

### Fix applied

Added partial covering index via `AddPerformanceIndexes` migration:

```sql
CREATE INDEX IF NOT EXISTS "IX_Incidents_OrgId_ProjectId_StartedAt_Active"
ON "Incidents" ("OrganizationId", "ProjectId", "StartedAt" DESC)
WHERE "IsDeleted" = false AND "Status" IN ('Open', 'Acknowledged');
```

The partial filter limits the index to only active incidents (roughly 50% of rows). The composite key `(OrganizationId, ProjectId)` matches the exact query predicate. Pre-sorting on `StartedAt DESC` eliminates the sort node entirely for `ORDER BY StartedAt DESC LIMIT n` pagination.

### After plan

```
Limit  (cost=8.59..158.78 rows=20 width=128) (actual time=0.327..0.382 rows=20 loops=1)
  Buffers: shared hit=44 read=3
  ->  Index Scan using "IX_Incidents_OrgId_ProjectId_StartedAt_Active" on "Incidents" i
        (cost=0.41..383.42 rows=51 width=128) (actual time=0.326..0.379 rows=20 loops=1)
        Index Cond: (("OrganizationId" = ...) AND ("ProjectId" = $0))
        Filter: ("Status" = 'Open'::text)
        Rows Removed by Filter: 20
        Buffers: shared hit=44 read=3
Planning Time: 2.780 ms
Execution Time: 0.438 ms
```

**After cost:** `cost=8.59` | **Execution time:** 0.44 ms | **Rows scanned:** 40 (20 discarded)  
**Improvement: 34.9 ms → 0.44 ms — 98.7% faster (79×)**

The planner switched to a straight Index Scan on the new partial index. Buffer pages dropped from 1 674 to 47. No sort node — the index already delivers rows in `StartedAt DESC` order.

---

## Query 2 — Active Alert Count (Dashboard Stat)

**Source:** `AlertRepository.GetActiveCountByOrganizationIdAsync(organizationId)`

### LINQ

```csharp
Set.Where(a => a.OrganizationId == organizationId
              && a.ResolvedAt == null
              && a.AcknowledgedAt == null)
   .CountAsync(ct);
```

### Generated SQL

```sql
SELECT COUNT(*)
FROM "Alerts"
WHERE "OrganizationId"  = @orgId
  AND "ResolvedAt"      IS NULL
  AND "AcknowledgedAt"  IS NULL
  AND "IsDeleted"       = false;
```

### Before plan

```
Finalize Aggregate  (cost=8297.11..8297.12 rows=1 width=8) (actual time=103.195..104.333 rows=1 loops=1)
  Buffers: shared hit=6250
  ->  Gather  (cost=8296.90..8297.11 rows=2 width=8) (actual time=100.466..104.328 rows=3 loops=1)
        Workers Planned: 2
        Workers Launched: 2
        ->  Partial Aggregate  (cost=7296.90..7296.91 rows=1 width=8) (actual time=80.772..80.772 rows=1 loops=3)
              ->  Parallel Seq Scan on "Alerts" a
                    Filter: ("ResolvedAt" IS NULL AND "AcknowledgedAt" IS NULL
                             AND NOT "IsDeleted" AND "OrganizationId" = ...)
                    Rows Removed by Filter: 63333
                    Buffers: shared hit=6250
Planning Time: 1.980 ms
Execution Time: 104.501 ms
```

**Before cost:** `cost=8297.11` | **Execution time:** 104.5 ms | **Rows scanned:** ~200 000 (all Alerts)  
**Diagnosis:** Full parallel sequential scan across the entire 200 000-row `Alerts` table. The existing `IX_Alerts_ProjectId_FiredAt` index is keyed on `ProjectId`, useless for an org-level count.

### Fix applied

Covering index with `INCLUDE (Severity)`:

```sql
CREATE INDEX IF NOT EXISTS "IX_Alerts_OrgId_FiredAt_Active"
ON "Alerts" ("OrganizationId", "FiredAt" DESC)
INCLUDE ("Severity")
WHERE "IsDeleted" = false;
```

`OrganizationId` as the leading key lets the planner restrict to one org immediately. `INCLUDE (Severity)` makes the index cover future dashboard queries that also need severity breakdown without a heap fetch.

### After plan

```
Aggregate  (cost=8063.57..8063.58 rows=1 width=8) (actual time=18.670..18.671 rows=1 loops=1)
  Buffers: shared hit=1292 read=254
  ->  Bitmap Heap Scan on "Alerts" a
        Recheck Cond: (("OrganizationId" = ...) AND (NOT "IsDeleted"))
        Filter: (("ResolvedAt" IS NULL) AND ("AcknowledgedAt" IS NULL))
        Rows Removed by Filter: 30000
        Heap Blocks: exact=1292
        ->  Bitmap Index Scan on "IX_Alerts_OrgId_FiredAt_Active"
              Index Cond: ("OrganizationId" = ...)
              Buffers: shared read=254
Planning Time: 0.409 ms
Execution Time: 18.753 ms
```

**After cost:** `cost=8063.57` | **Execution time:** 18.8 ms | **Rows from index:** 40 000 (org-scoped, non-deleted)  
**Improvement: 104.5 ms → 18.8 ms — 82% faster (5.6×)**

The planner replaced the full sequential scan with a Bitmap Index Scan scoped to one org. Buffer pages dropped from 6 250 to 1 546. Planning time also fell from 1.98 ms to 0.41 ms. The remaining heap scan is expected because `ResolvedAt IS NULL` and `AcknowledgedAt IS NULL` cannot be encoded in the index predicate; a future optimisation could add a partial index on `(OrganizationId, FiredAt)` filtered only to unresolved/unacknowledged rows if this query becomes the hottest path.

---

## Query 3 — Projects with Computed Counts (N+1 Elimination)

**Source:** `GetProjectsQueryHandler` → `ProjectRepository.GetWithCountsByOrganizationIdAsync`

### The N+1 Problem

The original handler called `GetByOrganizationIdAsync` which returned `LogSourceCount = 0` and `ActiveIncidentCount = 0` (hardcoded). A correct naive implementation using separate count queries per project would issue:

- **1 query** to fetch the projects page
- **N queries** to count LogSources per project
- **N queries** to count active Incidents per project

For a page of 10 projects that is **21 round trips**.

### Before (N+1 simulation) — individual query costs

**Step A — projects fetch (×1):**
```
Execution Time: 10.342 ms
Index Scan using IX_Projects_OrganizationId_Slug → 10 rows
```

**Step B-1 — LogSources count per project (×10):**
```
Execution Time: 0.165 ms each → 1.65 ms total
Seq Scan on LogSources (100 rows, small table)
```

**Step B-2 — active Incidents count per project (×10):**
```
Execution Time: 44.628 ms each → 446.28 ms total
Bitmap Heap Scan on Incidents via IX_Incidents_Status
Rows scanned: 25 000, rows removed by filter: 24 500
```

**Total N+1 cost: 10.342 + 1.65 + 446.28 = ~458 ms across 21 queries**

### Fix applied — single correlated subquery

`IProjectRepository` gained a new method:

```csharp
Task<IList<(Project project, int logSourceCount, int activeIncidentCount)>>
    GetWithCountsByOrganizationIdAsync(Guid orgId, int page, int pageSize, CancellationToken ct);
```

Implemented with an EF Core LINQ `.Select()` projection that the provider translates to one SQL statement:

```sql
SELECT
  p.*,
  (SELECT COUNT(*) FROM "LogSources" ls
   WHERE ls."ProjectId" = p."Id" AND ls."IsDeleted" = false)       AS "LogSourceCount",
  (SELECT COUNT(*) FROM "Incidents" i
   WHERE i."ProjectId"  = p."Id" AND i."IsDeleted" = false
     AND i."Status" IN ('Open', 'Acknowledged'))                    AS "ActiveIncidentCount"
FROM "Projects" p
WHERE p."OrganizationId" = @orgId AND p."IsDeleted" = false
ORDER BY p."Name"
LIMIT @pageSize OFFSET @offset;
```

### After plan

```
Limit  (cost=8.17..940.47 rows=1 width=724) (actual time=2.343..5.908 rows=10 loops=1)
  Buffers: shared hit=1678 read=178
  ->  Sort → Index Scan on IX_Projects_OrganizationId_Slug → 10 rows (0.090 ms)
      SubPlan 1 (LogSourceCount, ×10 loops)
        ->  Aggregate → Seq Scan on LogSources (0.024 ms each, 10 loops)
      SubPlan 2 (ActiveIncidentCount, ×10 loops)
        ->  Aggregate → Index Only Scan using IX_Incidents_OrgId_ProjectId_StartedAt_Active
              Index Cond: ("ProjectId" = p."Id")
              Heap Fetches: 0        ← index-only, zero heap I/O
              (0.554 ms each, 10 loops)
Planning Time: 1.128 ms
Execution Time: 6.035 ms
```

**After:** exactly **1 SQL statement**, 6.0 ms total  
**Improvement: ~458 ms / 21 queries → 6.0 ms / 1 query — 98.7% faster (76×)**

Key observation: SubPlan 2 uses an **Index Only Scan** on the new partial index with `Heap Fetches: 0` — the active incident count is satisfied entirely from index pages without touching heap blocks. This is the best possible execution for this subquery.

EF Core query log confirms exactly 1 SQL statement issued per `GetWithCountsByOrganizationIdAsync` call regardless of result-set size.
