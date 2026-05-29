# Postgres restore drill — tabletop

**Cadence:** quarterly tabletop; semi-annual real-restore run.
**Time budget:** tabletop 45 minutes; real-restore 90 minutes (RTO target
30 minutes, with 60 minutes of buffer for setup + teardown).
**Owner:** the on-call engineer for the quarter, with the founder present.

> **Why this runbook exists.** Untested backups are not backups. The
> first restore run is also the moment we discover everything we forgot
> to put in the runbook. This tabletop catches the gaps before a real
> incident does.

## Scenario

> "It is 03:14 UTC. The production Postgres lost the `Alerts` table to a
> bad migration that escaped review. The bad migration ran 2 hours ago.
> The API has been silently returning 500s for every alert-write since.
> Restore to T-2h."

## Pre-flight (5 min)

- [ ] Confirm the off-site pgBackRest repo is reachable
      (`pgbackrest --stanza=stacksift info` from any pgBackRest-equipped
      pod). The last `full` should be < 7 days old; the last `archive`
      should be < 5 min old.
- [ ] Confirm KMS access to the pgBackRest cipher key.
- [ ] Confirm the staging cluster is empty (any prior restore is torn down).

## Steps (35 min target — tabletop walks through; real run executes)

### 1. Stop writes to the source (real run only — skipped in tabletop)

```bash
kubectl -n stacksift scale deployment stacksift-api --replicas=0
kubectl -n stacksift scale deployment stacksift-cronworker --replicas=0
```

Rationale: any write that lands after the restore-target time is going
to be lost. Putting the API into a planned outage is a better customer
experience than a partial roll-forward.

### 2. Provision the restore target

In a dedicated `staging-restore` namespace, apply the StackSift Postgres
image (Plan 09 §9.4) with an empty PVC.

```bash
helm install stacksift-restore charts/stacksift \
  --namespace staging-restore --create-namespace \
  --set postgres.persistentVolumeClaim.size=200Gi \
  --set postgres.image.tag=$(git rev-parse --short HEAD)
```

### 3. Restore with PITR target

```bash
kubectl -n staging-restore exec -it deploy/stacksift-postgres -- bash -c "
  pgbackrest --stanza=stacksift \
    --type=time \
    --target='2026-05-29 01:14:00 UTC' \
    --target-action=promote \
    restore
"
```

Time the restore. The recorded RTO goes into
`docs/runbooks/restore-drill-rto-log.md` (real-run only) and gets
compared against the 30-minute SLA in the security page (Plan 11 §8).

### 4. Promote, smoke

```bash
kubectl -n staging-restore exec -it deploy/stacksift-postgres -- \
  pg_isready
# Sanity counts:
kubectl -n staging-restore exec -it deploy/stacksift-postgres -- \
  psql -U postgres -d stacksift -c "
    SELECT 'alerts' tbl, COUNT(*) FROM \"Alerts\"
    UNION ALL SELECT 'incidents', COUNT(*) FROM \"Incidents\"
    UNION ALL SELECT 'projects', COUNT(*) FROM \"Projects\";
  "
```

Sanity counts should be within the expected window: alerts > 0, incidents
roughly matching the last-known count from Grafana, no zero-row tables
that should have rows.

### 5. Application smoke against the restored DB

```bash
# Point a transient pod at the restored Postgres and run the
# integration-test smoke suite (a subset of the nightly suite).
kubectl -n staging-restore exec -it deploy/stacksift-api -- \
  dotnet test StackSift.Tests --filter "Category=RestoreSmoke"
```

### 6. Decide: promote or discard

- **Promote** (production swap): scale source API back up, point its
  ConnectionStrings__DefaultConnection at the restored cluster, then
  scale the source Postgres down. This is the real-incident path.
- **Discard** (drill run): teardown.

### 7. Teardown (drill only)

```bash
helm uninstall stacksift-restore --namespace staging-restore
kubectl delete namespace staging-restore
```

## Verification checklist (the gate to mark the drill complete)

- [ ] `pgbackrest info` shows the expected full + diff + archive cadence
      before and after.
- [ ] PITR landed within the target time ± 1 minute.
- [ ] Row counts on `Alerts`, `Incidents`, `Projects`, `LogSources`,
      `AccountExportRequests`, `AccountErasureRequests` match a
      pre-incident snapshot from the metrics or from a fresh
      `pg_dump --schema-only` diff.
- [ ] The smoke test suite passed against the restored DB.
- [ ] The actual RTO was captured and logged.
- [ ] Any documentation gap surfaced during the drill is filed as a
      follow-up issue (do not leave undocumented steps in this file —
      fix this file before closing the drill).

## Cross-references

- `docs/runbooks/backup-failure-modes.md` — what to do when restore
  itself fails (WAL gap, repo corruption, KMS unavailable).
- `docs/runbooks/master-key-offline-backup.md` — what to do when the
  KMS key is permanently lost (the Shamir-split last-resort path).
- `infrastructure/pgbackrest/pgbackrest.conf` — canonical repo config.
- ADR 0010 — encryption posture (why the KMS key is needed).
