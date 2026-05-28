#!/bin/sh
set -e

# Wait up to ~60s for Postgres before applying migrations. The compose
# healthcheck on the postgres service already gates this in normal operation;
# the loop is belt-and-braces against migration crashes if depends_on is
# misconfigured or the container is started outside compose.
host="${POSTGRES_HOST:-postgres}"
port="${POSTGRES_PORT:-5432}"
for i in $(seq 1 30); do
  if nc -z "$host" "$port" 2>/dev/null; then
    break
  fi
  echo "[entrypoint] waiting for $host:$port ($i/30)..."
  sleep 2
done

# Apply pending migrations using the self-contained bundle baked into the
# image. Idempotent — replays only what's not already in __EFMigrationsHistory.
# The connection string is read from ConnectionStrings__DefaultConnection at
# runtime per ASP.NET Core's standard env-var binding.
if [ -z "${ConnectionStrings__DefaultConnection:-}" ]; then
  echo "[entrypoint] ConnectionStrings__DefaultConnection is not set; aborting." >&2
  exit 1
fi

echo "[entrypoint] applying EF migrations..."
/app/migrate --connection "${ConnectionStrings__DefaultConnection}"

echo "[entrypoint] starting StackSift.Api..."
exec dotnet StackSift.Api.dll
