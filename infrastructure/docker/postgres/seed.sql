-- StackSift demo data seed (idempotent)
-- Generates: 5 orgs, 10 users each, 10 projects each, 1 000 incidents per project (~50 k),
--            4 alerts per incident (~200 k), 2 log sources per project (100 total)
--
-- Idempotency: if org 'a0000000-0000-0000-0000-000000000001' already exists the script
--              prints a notice and exits without touching any data.
-- Safe to re-run at any time.

DO $$
BEGIN

  -- ── idempotency guard ────────────────────────────────────────────────────
  IF EXISTS (
    SELECT 1 FROM "Organizations"
    WHERE "Id" = 'a0000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE NOTICE 'Demo seed already present — skipping.';
    RETURN;
  END IF;

  -- ── organizations (5) ───────────────────────────────────────────────────
  INSERT INTO "Organizations"
    ("Id", "Name", "Slug", "Plan", "CreatedAt", "UpdatedAt", "IsDeleted", "CreatedBy")
  VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Acme Corp',      'acme',     0, NOW(), NOW(), false, 'demo-seed'),
    ('a0000000-0000-0000-0000-000000000002', 'Globex Inc',     'globex',   0, NOW(), NOW(), false, 'demo-seed'),
    ('a0000000-0000-0000-0000-000000000003', 'Initech LLC',    'initech',  0, NOW(), NOW(), false, 'demo-seed'),
    ('a0000000-0000-0000-0000-000000000004', 'Umbrella Co',    'umbrella', 0, NOW(), NOW(), false, 'demo-seed'),
    ('a0000000-0000-0000-0000-000000000005', 'Dunder Mifflin', 'dunder',   0, NOW(), NOW(), false, 'demo-seed');

  -- ── users (10 per org = 50 total) ───────────────────────────────────────
  INSERT INTO "Users"
    ("Id", "OrganizationId", "Email", "DisplayName", "Role",
     "CreatedAt", "UpdatedAt", "IsDeleted", "CreatedBy")
  SELECT
    gen_random_uuid(),
    org_id,
    format('user%s@%s.example.com', u, org_slug),
    format('User %s (%s)', u, org_slug),
    CASE WHEN u = 1 THEN 'Admin' ELSE 'Member' END,
    NOW(), NOW(), false, 'demo-seed'
  FROM (VALUES
    ('a0000000-0000-0000-0000-000000000001'::uuid, 'acme'),
    ('a0000000-0000-0000-0000-000000000002'::uuid, 'globex'),
    ('a0000000-0000-0000-0000-000000000003'::uuid, 'initech'),
    ('a0000000-0000-0000-0000-000000000004'::uuid, 'umbrella'),
    ('a0000000-0000-0000-0000-000000000005'::uuid, 'dunder')
  ) AS t(org_id, org_slug)
  CROSS JOIN generate_series(1, 10) AS u;

  -- ── projects (10 per org = 50 total) ────────────────────────────────────
  INSERT INTO "Projects"
    ("Id", "OrganizationId", "Name", "Slug", "Description", "Color",
     "CreatedAt", "UpdatedAt", "IsDeleted", "CreatedBy")
  SELECT
    gen_random_uuid(),
    org_id,
    format('%s-project-%s', org_slug, p),
    format('%s-project-%s', org_slug, p),
    format('Demo project %s for %s', p, org_slug),
    CASE (p % 6)
      WHEN 0 THEN '#3B82F6'
      WHEN 1 THEN '#10B981'
      WHEN 2 THEN '#F59E0B'
      WHEN 3 THEN '#EF4444'
      WHEN 4 THEN '#8B5CF6'
      ELSE        '#06B6D4'
    END,
    NOW(), NOW(), false, 'demo-seed'
  FROM (VALUES
    ('a0000000-0000-0000-0000-000000000001'::uuid, 'acme'),
    ('a0000000-0000-0000-0000-000000000002'::uuid, 'globex'),
    ('a0000000-0000-0000-0000-000000000003'::uuid, 'initech'),
    ('a0000000-0000-0000-0000-000000000004'::uuid, 'umbrella'),
    ('a0000000-0000-0000-0000-000000000005'::uuid, 'dunder')
  ) AS t(org_id, org_slug)
  CROSS JOIN generate_series(1, 10) AS p;

  -- ── log sources (2 per project = 100 total) ─────────────────────────────
  INSERT INTO "LogSources"
    ("Id", "ProjectId", "OrganizationId", "Name", "Type", "IngestUrl", "ApiKey",
     "IsActive", "CreatedAt", "UpdatedAt", "IsDeleted", "CreatedBy")
  SELECT
    gen_random_uuid(),
    pr."Id",
    pr."OrganizationId",
    format('%s-source-%s', pr."Slug", s),
    CASE (s % 5)
      WHEN 0 THEN 'Application'
      WHEN 1 THEN 'Server'
      WHEN 2 THEN 'Database'
      WHEN 3 THEN 'Network'
      ELSE        'Custom'
    END,
    format('http://localhost:5190/api/v1/ingest/%s', gen_random_uuid()),
    gen_random_uuid()::text,
    true,
    NOW(), NOW(), false, 'demo-seed'
  FROM "Projects" pr
  CROSS JOIN generate_series(1, 2) AS s
  WHERE pr."CreatedBy" = 'demo-seed';

  -- ── incidents (1 000 per project = 50 000 total) ────────────────────────
  INSERT INTO "Incidents"
    ("Id", "ProjectId", "OrganizationId", "Status", "Title", "Description",
     "Severity", "StartedAt", "AcknowledgedAt", "ResolvedAt", "ClosedAt",
     "CreatedAt", "UpdatedAt", "IsDeleted", "CreatedBy")
  SELECT
    gen_random_uuid(),
    pr."Id",
    pr."OrganizationId",
    CASE (i % 4)
      WHEN 0 THEN 'Open'
      WHEN 1 THEN 'Acknowledged'
      WHEN 2 THEN 'Resolved'
      ELSE        'Closed'
    END,
    format(
      'Incident #%s — %s spike on %s',
      i,
      CASE (i % 3) WHEN 0 THEN 'CPU' WHEN 1 THEN 'Memory' ELSE 'Latency' END,
      pr."Slug"
    ),
    'Automatically generated incident for SQL optimisation demo.',
    CASE (i % 4)
      WHEN 0 THEN 'Low'
      WHEN 1 THEN 'Medium'
      WHEN 2 THEN 'High'
      ELSE        'Critical'
    END,
    NOW() - (((i % 365) || ' days')::interval + ((i % 24) || ' hours')::interval),
    -- AcknowledgedAt: set for Acknowledged / Resolved / Closed
    CASE WHEN (i % 4) IN (1, 2, 3)
      THEN NOW() - (((i % 365) || ' days')::interval + '1 hour'::interval)
      ELSE NULL
    END,
    -- ResolvedAt: set for Resolved / Closed
    CASE WHEN (i % 4) IN (2, 3)
      THEN NOW() - (((i % 365) || ' days')::interval - '2 hours'::interval)
      ELSE NULL
    END,
    -- ClosedAt: set for Closed only
    CASE WHEN (i % 4) = 3
      THEN NOW() - (((i % 365) || ' days')::interval - '3 hours'::interval)
      ELSE NULL
    END,
    NOW(), NOW(), false, 'demo-seed'
  FROM "Projects" pr
  CROSS JOIN generate_series(1, 1000) AS i
  WHERE pr."CreatedBy" = 'demo-seed';

  -- ── alerts (4 per incident = ~200 000 total) ────────────────────────────
  INSERT INTO "Alerts"
    ("Id", "ProjectId", "OrganizationId", "Severity", "Title", "Description",
     "FiredAt", "AcknowledgedAt", "ResolvedAt", "IncidentId",
     "CreatedAt", "UpdatedAt", "IsDeleted", "CreatedBy")
  SELECT
    gen_random_uuid(),
    inc."ProjectId",
    inc."OrganizationId",
    CASE (a % 4)
      WHEN 0 THEN 'Low'
      WHEN 1 THEN 'Medium'
      WHEN 2 THEN 'High'
      ELSE        'Critical'
    END,
    format(
      'Alert %s: %s @ %s',
      a,
      CASE (a % 3) WHEN 0 THEN 'CPU > 90%' WHEN 1 THEN 'Memory OOM' ELSE 'P99 > 2 s' END,
      to_char(inc."StartedAt", 'YYYY-MM-DD HH24:MI')
    ),
    'Alert fired by automated rule — SQL optimisation demo.',
    inc."StartedAt" + ((a * 5) || ' minutes')::interval,
    CASE WHEN inc."Status" IN ('Acknowledged', 'Resolved', 'Closed')
      THEN inc."StartedAt" + ((a * 5 + 30) || ' minutes')::interval
      ELSE NULL
    END,
    CASE WHEN inc."Status" IN ('Resolved', 'Closed')
      THEN inc."StartedAt" + '2 hours'::interval
      ELSE NULL
    END,
    inc."Id",
    NOW(), NOW(), false, 'demo-seed'
  FROM "Incidents" inc
  CROSS JOIN generate_series(1, 4) AS a
  WHERE inc."CreatedBy" = 'demo-seed';

  RAISE NOTICE 'Demo seed complete: 5 orgs, 50 projects, 100 log sources, ~50 000 incidents, ~200 000 alerts.';

END $$;
