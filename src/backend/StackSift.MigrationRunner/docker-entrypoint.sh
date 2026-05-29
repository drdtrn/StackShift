#!/bin/sh
set -e

host="${POSTGRES_HOST:-postgres}"
port="${POSTGRES_PORT:-5432}"
for i in $(seq 1 30); do
  if nc -z "$host" "$port" 2>/dev/null; then
    break
  fi
  echo "[migrate] waiting for $host:$port ($i/30)..."
  sleep 2
done

if [ -z "${ConnectionStrings__DefaultConnection:-}" ]; then
  echo "[migrate] ConnectionStrings__DefaultConnection is not set; aborting." >&2
  exit 2
fi

exec dotnet StackSift.MigrationRunner.dll
