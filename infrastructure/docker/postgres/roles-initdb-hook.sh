#!/bin/bash
# Creates the two runtime roles the RLS design relies on (Plan 08 §2.2). Runs
# once at cluster initialisation. stacksift_owner bypasses RLS (migrations);
# stacksift_app does not (the runtime cutover target — Plan 08 §2.B). Dev
# passwords default here; production injects them from Vault (Plan 08 §9).
set -euo pipefail

APP_PASSWORD="${STACKSIFT_APP_PASSWORD:-stacksift_app_dev}"
OWNER_PASSWORD="${STACKSIFT_OWNER_PASSWORD:-stacksift_owner_dev}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'stacksift_owner') THEN
        CREATE ROLE stacksift_owner WITH LOGIN PASSWORD '${OWNER_PASSWORD}' BYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'stacksift_app') THEN
        CREATE ROLE stacksift_app WITH LOGIN PASSWORD '${APP_PASSWORD}' NOBYPASSRLS;
    END IF;
END
\$\$;

GRANT USAGE ON SCHEMA public TO stacksift_app, stacksift_owner;
GRANT ALL ON ALL TABLES IN SCHEMA public TO stacksift_owner;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO stacksift_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO stacksift_app, stacksift_owner;

-- Lets stacksift_app assume the owner for trusted system-scope work (SET ROLE).
GRANT stacksift_owner TO stacksift_app;
-- Hangfire creates and owns its own (RLS-free) schema as the app role.
GRANT CREATE ON DATABASE "$POSTGRES_DB" TO stacksift_app;

-- Defaults for objects the migrator (stacksift_owner) creates after the cutover.
ALTER DEFAULT PRIVILEGES FOR ROLE stacksift_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO stacksift_app;
ALTER DEFAULT PRIVILEGES FOR ROLE stacksift_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO stacksift_app;
-- Defaults for objects the bootstrap superuser creates (extensions, fallback path).
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO stacksift_owner;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO stacksift_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO stacksift_app, stacksift_owner;
SQL
