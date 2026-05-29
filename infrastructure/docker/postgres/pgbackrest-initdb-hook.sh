#!/usr/bin/env bash
set -euo pipefail

# initdb hook — runs once per fresh data directory. Appends StackSift
# postgresql.conf overrides and creates the pgbackrest stanza when a repo
# is configured. Idempotent: re-running on an already-initialised cluster
# produces the same file because the include marker is unique.

OVERRIDES_SRC="/etc/stacksift/postgresql.overrides.conf"
OVERRIDES_DST="${PGDATA}/postgresql.conf"
INCLUDE_MARKER="# === StackSift overrides — DO NOT EDIT (managed by initdb hook) ==="

if ! grep -qF "$INCLUDE_MARKER" "$OVERRIDES_DST"; then
  {
    echo
    echo "$INCLUDE_MARKER"
    cat "$OVERRIDES_SRC"
  } >> "$OVERRIDES_DST"
  echo "[stacksift-pg] appended overrides to postgresql.conf"
fi

# Create the local stanza on first boot when a repo is configured. The
# `pgbackrest stanza-create` call needs Postgres to be reachable; on
# initdb hooks the server is not yet listening, so the script writes a
# one-shot flag file and the actual stanza-create runs on first
# successful Postgres connection (via a separate init container in k8s
# or `docker compose --profile backup-init` locally).
if [ -n "${PGBACKREST_REPO1_S3_BUCKET:-}" ]; then
  install -d -o postgres -g postgres -m 0750 "${PGDATA}/pgbackrest-init"
  touch "${PGDATA}/pgbackrest-init/needs-stanza-create"
  chown postgres:postgres "${PGDATA}/pgbackrest-init/needs-stanza-create"
fi
