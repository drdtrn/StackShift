# Data retention by plan tier

Verbatim source for the marketing site's `/legal/retention` page (Plan 11 §6)
and the in-app `/settings/plan` view. If you change a value here, update
both surfaces in the same release.

| Resource                      | Free  | Indie  | Team   |
|-------------------------------|-------|--------|--------|
| Log entries (ES)              | 3 d   | 30 d   | 90 d   |
| Alerts (Postgres)             | 30 d  | 180 d  | 365 d  |
| Incidents (Postgres)          | 30 d  | 180 d  | 365 d  |
| AI analyses (Postgres)        | indef | indef  | indef  |
| Audit events (Postgres)       | 365 d (regulatory floor — same for all tiers) |
| Stripe webhook events (audit) | 365 d (same for all tiers)                    |
| File uploads (MinIO)          | 30 d  | 180 d  | 365 d  |

## Behaviour on plan change

The handler that consumes `OrgPlanChangedMessage`
(`src/backend/StackSift.Infrastructure/Messaging/Consumers/OrgPlanChangedConsumer.cs`)
applies these rules.

### Upgrade (Free → Indie, Indie → Team, or Free → Team)
- New indices created after the upgrade inherit the longer retention ILM
  policy via the `stacksift-logs-*` template default override.
- Existing indices keep their original retention. The UI surfaces "Logs from
  before \<upgrade date\> will be deleted on their original schedule" once
  (Plan 02 §2.5 owns the notification).

### Downgrade (Team → Indie, Indie → Free)
- The org enters a 30-day grace period. During grace, existing data remains
  accessible at the old retention; new data is created under the new policy.
- After grace, an `AlignIndicesToNewPlanJob` (Hangfire one-shot, enqueued at
  the downgrade moment) re-applies the shorter ILM policy to all of the
  org's indices via `_settings` PUT — ES then deletes anything past the
  shorter retention window.
- Customer-facing wording: "Downgrades take effect for new data immediately;
  existing data is retained for 30 days then aligned with your new plan."

### Cancellation (any tier → Free)
- 30-day grace, then the export-or-delete flow per §9.8 / §9.9. The user
  receives an email with both options.

## Daily enforcement

The `RetentionEnforcementJob` (Hangfire recurring, daily 02:30 UTC, runs only
on the dedicated `cronworker` deployment) sweeps Postgres tables for rows
older than the tier limit. It:

- **Hard-deletes** rows from `Alerts`, `Incidents`, `AuditLogEntries`
  (older than the 365-day regulatory floor), and `StripeWebhookEvents`
  (older than 365 days) using `ExecuteDeleteAsync` to avoid row-load
  round-trips.
- **Never deletes** AI analyses (kept indefinitely while the parent
  organization is active per the table above).

ES log retention is handled by the per-tier ILM policies registered by
`EsLifecycleBootstrap` at API start (Plan 09 §9.5 / Phase 5).

## Source of truth

This file is the canonical source. Drift between it, the marketing legal
page, and the in-app plan view is a bug. The CI step `retention-sync` (Plan
10 §10.x) verifies all three surface the same numbers — if any of them
drifts the build fails.
