#!/usr/bin/env bash
set -euo pipefail

ES_URL="${ES_URL:-http://localhost:9200}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

curl -fsS -X PUT "$ES_URL/_ilm/policy/stacksift-logs-ilm" \
  -H 'Content-Type: application/json' \
  --data-binary "@$ROOT_DIR/infrastructure/elasticsearch/ilm-policy.json"

curl -fsS -X PUT "$ES_URL/_index_template/stacksift-logs-template" \
  -H 'Content-Type: application/json' \
  --data-binary "@$ROOT_DIR/infrastructure/elasticsearch/index-template.json"
