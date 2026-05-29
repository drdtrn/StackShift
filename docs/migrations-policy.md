# Database migrations — expand/contract policy

> Every EF Core migration in `src/backend/StackSift.Infrastructure/Persistence/Migrations/`
> must obey the rules below. The migration runner image (`stacksift-migrator`)
> applies migrations exactly once per release in front of a rolling API
> deployment; a destructive migration that lands before the API binary that
> reads the new schema is in production breaks the running fleet mid-deploy.

## 1. Three-migration cap per schema change

Every schema change is split into up to **three** migrations, shipped across
**two releases**:

| Step       | Effect                                            | When it ships                           |
|------------|---------------------------------------------------|-----------------------------------------|
| Expand     | Add the new column/table/index. Nullable, no default. The old code keeps working. | Release N                               |
| Backfill   | Populate the new column. Idempotent SQL or a one-shot Hangfire job for tables > 10M rows. | Release N (same PR as expand)           |
| Contract   | Drop the old column, add `NOT NULL`, drop the legacy index. | **Release N+1**, after every replica is on the new code |

The contract migration is committed in a separate PR with the body tagged
`Land-In-Release: N+1` so reviewers know it must wait.

A single-PR expand-and-contract is **allowed only for empty tables and brand-new
columns** that the running code does not read. If the table has rows or the
column is referenced by a binary already in production, you must split.

## 2. Concurrent index creation

For any table with > 1M rows or any hot-path table (`Alerts`,
`LogSources`, `LogEntries`, `AuditLogEntries`, `Incidents`,
`AiAnalyses`), index creation must use `CREATE INDEX CONCURRENTLY`. EF's
`migrationBuilder.Sql(...)` is the only way to do this, and the migration must
be marked non-transactional:

```csharp
public partial class AddOrgIdIndexOnAlerts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_alerts_organization_id ON \"Alerts\" (\"OrganizationId\");",
            suppressTransaction: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql(
            "DROP INDEX CONCURRENTLY IF EXISTS ix_alerts_organization_id;",
            suppressTransaction: true);
    }
}
```

`CREATE INDEX CONCURRENTLY` cannot run inside a transaction; without
`suppressTransaction: true` the migration silently degrades to a blocking
`CREATE INDEX` that locks the table for writes.

## 3. Forbidden operations without an ADR

These operations require a written ADR in `docs/adr/` referenced from the
migration's PR description **and** an `[Expected: destructive]` marker comment
inside the migration file (see §4):

- `DROP TABLE` of any table that ever held customer data.
- `ALTER COLUMN ... TYPE` that narrows the type (e.g. `text` → `varchar(64)`,
  `bigint` → `int`).
- Renaming a column without a transitional alias view or a backfilled
  duplicate column.
- Adding `NOT NULL` to a column that currently has rows lacking a value.

If you find yourself wanting one of these, the answer is almost always to
write it as a contract migration in Release N+1 of an expand/contract pair.

## 4. Pre-merge CI check

The `migrations-policy` job in `.github/workflows/ci.yml` runs against every
PR touching `src/backend/StackSift.Infrastructure/Persistence/Migrations/**`.
It grep-scans the migration source for these patterns:

```text
DropTable(
DropColumn(
AlterColumn(... nullable: false ...) where the previous state was nullable: true
DropForeignKey(
```

If any match is found, the job fails unless the migration file contains the
line:

```csharp
// [Expected: destructive]
```

This is a deliberate friction point. Bypassing it without an ADR is grounds
for the PR to be sent back.

## 5. Runbook: how to apply

```bash
# Local dev — one-shot, doesn't change the default compose flow:
docker compose --profile migrate run --rm migrate

# Staging / prod (k8s):
helm upgrade stacksift charts/stacksift --version <new>
#   ↑ Helm runs the pre-install/pre-upgrade migrate Job first; the API
#     deployment rolls only after the Job exits 0.

# Forensic — inspect a failed Job:
kubectl logs -l app.kubernetes.io/component=migrate --tail=200
```

Rolling back a contract migration is not safe — once the column is dropped,
the only restoration path is the `pgBackRest` PITR drill (see
`docs/runbooks/restore-drill.md`). Plan contract migrations like you plan
production deploys: there is no undo.
