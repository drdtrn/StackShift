#!/bin/sh
set -e

# Wait up to ~60s for Postgres before booting. The compose healthcheck on the
# postgres service already gates this in normal operation; the loop is
# belt-and-braces against startup races if depends_on is misconfigured or the
# container is started outside compose.
host="${POSTGRES_HOST:-postgres}"
port="${POSTGRES_PORT:-5432}"
for i in $(seq 1 30); do
  if nc -z "$host" "$port" 2>/dev/null; then
    break
  fi
  echo "[entrypoint] waiting for $host:$port ($i/30)..."
  sleep 2
done

if [ -z "${ConnectionStrings__DefaultConnection:-}" ]; then
  echo "[entrypoint] ConnectionStrings__DefaultConnection is not set; aborting." >&2
  exit 1
fi

# Migrations are applied by the StackSift.MigrationRunner image (k8s
# pre-install/pre-upgrade Job, or `docker compose --profile migrate run --rm migrate`
# locally) before any API pod starts. The /health/ready probe keeps this pod
# un-routable until __EFMigrationsHistory matches the binary's expectations.
echo "[entrypoint] starting StackSift.Api..."
exec dotnet StackSift.Api.dll
