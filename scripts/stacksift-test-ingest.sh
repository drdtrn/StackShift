#!/usr/bin/env bash
# Post one synthetic log entry to StackSift to verify connectivity.
#
# Reads four env vars (no defaults, so a misconfig fails loudly):
#   STACKSIFT_INGEST_URL     e.g. http://localhost:5190/api/v1/logs/ingest
#   STACKSIFT_API_KEY        ss_... key from the dashboard, never commit
#   STACKSIFT_PROJECT_ID     UUID from the dashboard
#   STACKSIFT_LOG_SOURCE_ID  UUID from the dashboard
#
# Exit 0 on 2xx, 1 on any other response or curl failure.

set -euo pipefail

require_env() {
  local name="$1"
  if [ -z "${!name:-}" ]; then
    echo "error: $name is not set" >&2
    exit 2
  fi
}

require_env STACKSIFT_INGEST_URL
require_env STACKSIFT_API_KEY
require_env STACKSIFT_PROJECT_ID
require_env STACKSIFT_LOG_SOURCE_ID

ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
body=$(cat <<JSON
{
  "projectId": "$STACKSIFT_PROJECT_ID",
  "logSourceId": "$STACKSIFT_LOG_SOURCE_ID",
  "entries": [{
    "level": "Info",
    "message": "stacksift-test-ingest.sh synthetic event",
    "timestamp": "$ts",
    "serviceName": "stacksift-test-ingest",
    "metadata": { "synthetic": true, "from": "scripts/stacksift-test-ingest.sh" }
  }]
}
JSON
)

echo "→ POST $STACKSIFT_INGEST_URL"
start=$(date +%s.%N)
http_status=$(curl -sS -o /dev/null -w "%{http_code}" \
  -X POST "$STACKSIFT_INGEST_URL" \
  -H "X-Api-Key: $STACKSIFT_API_KEY" \
  -H "Content-Type: application/json" \
  --data "$body")
end=$(date +%s.%N)
elapsed=$(awk "BEGIN { printf \"%.2f\", $end - $start }")

if [ "$http_status" -ge 200 ] && [ "$http_status" -lt 300 ]; then
  echo "← $http_status (${elapsed}s)"
  exit 0
fi

echo "← $http_status (${elapsed}s)  — unexpected, check api-reference.md §Error responses" >&2
exit 1
