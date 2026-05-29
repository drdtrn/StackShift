# syntax=docker/dockerfile:1.7
#
# StackSift Postgres image — pgvector/pgvector:pg16 with pgBackRest bolted on.
# Plan 09 Decision 0.3: bake-our-own keeps the upstream pgvector binaries and
# avoids the operational hand-off of moving to crunchydata/postgres.
#
# Layered on top of the existing pgvector/pgvector:pg16 (Debian-based).
# Adds:
#   - pgbackrest from Debian backports (latest stable)
#   - a default /etc/pgbackrest/pgbackrest.conf (template — overlaid via
#     compose / configmap at runtime)
#   - postgresql.conf overrides enabling continuous WAL archiving + the
#     auto_explain extension (Plan 09 §9.13 — configured here so Phase 12
#     does not need a second image swap)
#
# The image is referenced as `stacksift-postgres:local` from compose and
# `ghcr.io/drdtrn/stacksift-postgres:<tag>` from the docker-build matrix.

FROM pgvector/pgvector:pg16

# pgbackrest is on bookworm-backports. The trixie series of pgvector/pgvector
# already includes apt-transport-https, but install both anyway to keep the
# Dockerfile portable to older bases.
RUN set -eux; \
    apt-get update; \
    # Pull the latest patched versions of every package the upstream
    # pgvector/pgvector:pg16 image baked at its release time. Without this,
    # Trivy flags libgnutls30 / libcap2 / libgssapi-krb5-2 etc. with HIGH
    # and CRITICAL CVEs that are fixed in the current Debian point release.
    DEBIAN_FRONTEND=noninteractive apt-get -y --no-install-recommends upgrade; \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates \
        apt-transport-https \
        pgbackrest; \
    apt-get clean; \
    rm -rf /var/lib/apt/lists/*; \
    install -d -o postgres -g postgres -m 0750 /var/log/pgbackrest /var/lib/pgbackrest /var/spool/pgbackrest /etc/pgbackrest /etc/pgbackrest/conf.d

# Default pgbackrest.conf — env-templated by the entrypoint so the same
# image works for dev (MinIO) and prod (S3 + cross-account replica).
COPY pgbackrest.conf.template /etc/pgbackrest/pgbackrest.conf.template
COPY postgresql.overrides.conf /etc/stacksift/postgresql.overrides.conf
COPY docker-entrypoint-overlay.sh /usr/local/bin/stacksift-pg-overlay.sh
RUN chmod +x /usr/local/bin/stacksift-pg-overlay.sh

# The pgvector image's entrypoint runs initdb on first boot and then chains
# into the standard postgres entrypoint. We wedge the overlay in via an
# initdb hook (runs once per cluster initialisation) plus a custom
# command that materialises the templated pgbackrest.conf on every boot.
COPY pgbackrest-initdb-hook.sh /docker-entrypoint-initdb.d/00-pgbackrest.sh
RUN chmod +x /docker-entrypoint-initdb.d/00-pgbackrest.sh

# Override the default command so the env→config template materialisation
# happens before `postgres` starts.
CMD ["stacksift-pg-overlay.sh", "postgres"]
