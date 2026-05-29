#!/usr/bin/env bash
set -euo pipefail

# Materialise /etc/pgbackrest/pgbackrest.conf from the env-substituted
# template every boot, then chain into the standard pgvector entrypoint.
# Env defaults are conservative — production overrides them at runtime.

: "${PGBACKREST_REPO1_TYPE:=}"
: "${PGBACKREST_REPO1_S3_ENDPOINT:=}"
: "${PGBACKREST_REPO1_S3_BUCKET:=}"
: "${PGBACKREST_REPO1_S3_REGION:=us-east-1}"
: "${PGBACKREST_REPO1_S3_KEY:=}"
: "${PGBACKREST_REPO1_S3_KEY_SECRET:=}"
: "${PGBACKREST_REPO1_S3_URI_STYLE:=path}"
: "${PGBACKREST_REPO1_PATH:=/stacksift}"
: "${PGBACKREST_REPO1_RETENTION_FULL:=4}"
: "${PGBACKREST_REPO1_RETENTION_DIFF:=14}"
: "${PGBACKREST_REPO1_RETENTION_ARCHIVE:=14}"
: "${PGBACKREST_REPO1_CIPHER_TYPE:=aes-256-cbc}"
: "${PGBACKREST_REPO1_CIPHER_PASS:=}"
: "${PGBACKREST_REPO1_STORAGE_VERIFY_TLS:=y}"
: "${PGBACKREST_PROCESS_MAX:=2}"
: "${PGBACKREST_LOG_LEVEL_CONSOLE:=info}"
: "${PGBACKREST_LOG_LEVEL_FILE:=detail}"
: "${PGBACKREST_PG1_PATH:=${PGDATA:-/var/lib/postgresql/data}}"
: "${PGBACKREST_PG1_PORT:=5432}"
: "${PGBACKREST_PG1_USER:=${POSTGRES_USER:-postgres}}"

# envsubst over a known allowlist keeps random $VAR-shaped strings in the
# template (none today) from being clobbered.
envsubst < /etc/pgbackrest/pgbackrest.conf.template > /etc/pgbackrest/pgbackrest.conf
chown postgres:postgres /etc/pgbackrest/pgbackrest.conf
chmod 0640 /etc/pgbackrest/pgbackrest.conf

# Chain into the original postgres entrypoint (preserves all upstream
# init / pwfile / docker-entrypoint-initdb.d semantics).
exec docker-entrypoint.sh "$@"
