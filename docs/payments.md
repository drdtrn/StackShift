# Payments — Operator Runbook

> Audience: on-call / SRE.
> Scope: day-to-day operations of the Stripe-backed billing system shipped in PAY-01 → PAY-08. For architectural rationale see `zhelpers/Payments/plan.md`.

---

## 1. What lives where

| Surface | Path |
|---|---|
| Backend endpoints | `POST /api/v1/billing/checkout-session`, `POST /api/v1/billing/portal-session`, `GET /api/v1/billing/subscription`, `POST /api/v1/billing/webhook` |
| Webhook command handler | `src/backend/StackSift.Application/Commands/Billing/ProcessStripeWebhookCommand.cs` |
| Stripe SDK wrapper | `src/backend/StackSift.Infrastructure/Billing/StripeService.cs` |
| Reconciliation job | `src/backend/StackSift.Infrastructure/Jobs/StripeReconciliationJob.cs` (Hangfire, weekly Sun 03:00 UTC) |
| Frontend billing panel | `src/frontend/src/app/(dashboard)/settings/_components/BillingPanel.tsx` |
| Marketing CTAs | `src/marketing/src/app/_lib/cta.ts` |

---

## 2. Configuration

The backend reads from `appsettings.*` + `dotnet user-secrets` / env vars:

```
Stripe:ApiKey                # sk_test_… (dev) or sk_live_… (prod)
Stripe:WebhookSecret         # whsec_…
Stripe:Prices:Indie          # price_… for the $19/mo Indie product
Stripe:Prices:Team           # price_… for the $79/mo Team product
Stripe:CheckoutSuccessUrl    # frontend success URL
Stripe:CheckoutCancelUrl     # frontend cancel URL
Stripe:PortalReturnUrl       # where the Stripe Customer Portal returns the user
```

> **Never** put real Stripe keys in `appsettings.Development.json`. Use `dotnet user-secrets` locally and the deployed secret manager (M4) in production.

Set them locally:

```bash
cd src/backend/StackSift.Api
dotnet user-secrets set "Stripe:ApiKey"        "sk_test_…"
dotnet user-secrets set "Stripe:WebhookSecret" "whsec_…"
dotnet user-secrets set "Stripe:Prices:Indie"  "price_…"
dotnet user-secrets set "Stripe:Prices:Team"   "price_…"
```

---

## 3. Common tasks

### Issue a refund

We do not refund in-app. Open the Stripe Dashboard → Customers → search for the org → Payments → click the charge → Refund. The refund webhook (`charge.refunded`) currently has no handler — it's a no-op in our app, which is intentional.

### Rotate the webhook signing secret

1. Stripe Dashboard → Developers → Webhooks → click the endpoint → Roll secret.
2. Update `dotnet user-secrets set "Stripe:WebhookSecret" "whsec_…"` in prod (via secret manager).
3. Restart the API instances. Existing in-flight requests will fail signature verification with HTTP 400 — Stripe retries automatically.

### Add a new plan / price

1. Stripe Dashboard → Products → add Product and Price.
2. Add the `price_…` ID to `Stripe:Prices.<NewPlan>` config.
3. Extend `Domain.Enums.Plan`, `PlanLimits.Map`, the `BillingPriceMap` Application options, and the `ResolvePlanFromPriceId` switch in `ProcessStripeWebhookCommandHandler`.
4. Add a new tier card on the marketing site (`src/marketing/src/app/_components/Pricing.tsx`) and a button in `BillingPanel`.

### Handle a stuck webhook event

Symptom: a webhook event is processed late or not at all.

1. Find the event in `StripeWebhookEvents` table:
   ```sql
   SELECT * FROM "StripeWebhookEvents"
   WHERE "EventId" = 'evt_…' ORDER BY "ReceivedAt" DESC;
   ```
2. If `ProcessedAt IS NULL` and `ProcessingError IS NOT NULL`, fix the underlying error and let Stripe retry (Stripe retries for up to 3 days).
3. If Stripe gave up but the org row is wrong, replay manually from the Stripe Dashboard (Webhooks → endpoint → Resend) or wait for the next weekly `StripeReconciliationJob` run.

---

## 4. Monitoring

### Loki queries

```logql
{app="stacksift"} | json | EventType="customer.subscription.updated"
{app="stacksift", level="warning"} |= "signature verification failed"
{app="stacksift"} |= "OrgPlanChangedMessage"
```

### Dashboard panels (M4 follow-up)

- `stripe_webhook_received_total{type="…"}` — webhook delivery rate per event type
- `stripe_webhook_signature_failed_total` — should be 0; alarm on `>0`
- `stripe_webhook_processed_seconds` — p50/p95/p99 processing latency
- `org_plan_active_subscriptions{plan="indie|team"}` — paid customers gauge

---

## 5. Incident playbooks

### "Customer paid but plan didn't upgrade"

1. Verify in Stripe Dashboard that the subscription is `active`.
2. Check `StripeWebhookEvents` for the `customer.subscription.created` event.
3. If missing, resend from Stripe Dashboard.
4. If present with `ProcessingError`, read the message and fix the bug; clear the error by deleting the row (`DELETE FROM "StripeWebhookEvents" WHERE "EventId" = 'evt_…'`) and Stripe will replay on its next retry.
5. Last resort: directly update the org row to match Stripe, then file a bug.

### "Customer cancelled but is still being charged"

This should be impossible — `customer.subscription.deleted` is fired by Stripe and our handler nulls the subscription. Investigate:

1. Stripe Dashboard → Subscriptions → confirm `canceled`.
2. If still `active` in Stripe, the customer didn't actually cancel. Cancel via Stripe Dashboard.
3. If `canceled` in Stripe but our org row still says `Indie/Team`, check `StripeWebhookEvents` for the `customer.subscription.deleted` event.

### "Webhook signature verification failing in CI/staging"

The webhook secret is environment-specific. Test-mode `whsec_…` won't validate Live-mode events and vice versa. Verify the matching pair.

---

## 6. Test-mode vs Live-mode cutover

When promoting from test to live:

1. Stripe Dashboard → toggle to Live mode.
2. Create matching Products + Prices (different `price_…` IDs).
3. Configure the Live-mode Customer Portal (same toggles as test).
4. Add a Live webhook endpoint pointing at the production URL.
5. Rotate all four secrets in the production secret store: `Stripe:ApiKey`, `Stripe:WebhookSecret`, `Stripe:Prices:Indie`, `Stripe:Prices:Team`.
6. Run a smoke test: a small real charge → immediate refund.
