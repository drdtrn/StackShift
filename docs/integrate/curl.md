# Sending logs to StackSift with curl

This recipe is the no-SDK path. Useful for languages StackSift has no
dedicated SDK for, for one-off scripts, and for diagnosing connection
problems independently of any client library.

For the canonical request/response shape, see [api-reference.md](./api-reference.md).

---

## Prerequisites

You need three values from the StackSift dashboard:

- The **ingest URL** — `https://api.stacksift.com/api/v1/logs/ingest`
  in production, or `http://localhost:5190/api/v1/logs/ingest` in local
  development.
- A **log-source API key**, revealed once on the integration page. Starts
  with `ss_`.
- The **project ID** and **log source ID** — both UUIDs, both visible on
  the integration page.

Export them once so the snippets below stay clean:

```bash
export STACKSIFT_INGEST_URL="http://localhost:5190/api/v1/logs/ingest"
export STACKSIFT_API_KEY="ss_AbCdEf12..."          # never commit this
export STACKSIFT_PROJECT_ID="11111111-1111-1111-1111-111111111111"
export STACKSIFT_LOG_SOURCE_ID="22222222-2222-2222-2222-222222222222"
```

---

## Single event

```bash
curl -X POST "$STACKSIFT_INGEST_URL" \
  -H "X-Api-Key: $STACKSIFT_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$STACKSIFT_PROJECT_ID\",
    \"logSourceId\": \"$STACKSIFT_LOG_SOURCE_ID\",
    \"entries\": [{
      \"level\": \"Error\",
      \"message\": \"Checkout failed for user u_42\",
      \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
      \"serviceName\": \"checkout-svc\",
      \"metadata\": { \"orderId\": \"o_99\", \"userId\": \"u_42\" }
    }]
  }"
```

Expected response: `202 Accepted` with an empty body. Logs appear in the
StackSift live tail within ~1 second.

---

## A batch from a file

For higher throughput, send up to 1000 entries per request. Build the
batch as a JSON file:

```bash
cat > batch.json <<EOF
{
  "projectId": "$STACKSIFT_PROJECT_ID",
  "logSourceId": "$STACKSIFT_LOG_SOURCE_ID",
  "entries": [
    {
      "level": "Info",
      "message": "Worker started",
      "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
      "serviceName": "worker"
    },
    {
      "level": "Warning",
      "message": "Retrying upstream call",
      "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
      "serviceName": "worker",
      "metadata": { "attempt": 3, "upstream": "billing-api" }
    }
  ]
}
EOF

curl -X POST "$STACKSIFT_INGEST_URL" \
  -H "X-Api-Key: $STACKSIFT_API_KEY" \
  -H "Content-Type: application/json" \
  --data @batch.json
```

---

## Test script

A ready-made one-liner ships at
[`scripts/stacksift-test-ingest.sh`](../../scripts/stacksift-test-ingest.sh).
It reads the four env vars above and posts a synthetic event. Use it
the moment you have a new API key to verify the full pipeline works
before you wire it into your application.

```bash
./scripts/stacksift-test-ingest.sh
```

Output on success:

```
→ POST http://localhost:5190/api/v1/logs/ingest
← 202 Accepted (0.18s)
```

---

## Common errors

See [api-reference.md §Error responses](./api-reference.md#error-responses)
for the full matrix. The three you'll see most:

- **401** — `X-Api-Key` is missing, malformed, or revoked. Re-check
  the value in the dashboard.
- **404** — `projectId` or `logSourceId` doesn't belong to your key's
  organisation. Easy to misconfigure when copy-pasting between
  projects.
- **429** — You're sending more than 100 batches/minute on one key.
  Honour the `Retry-After` response header.
