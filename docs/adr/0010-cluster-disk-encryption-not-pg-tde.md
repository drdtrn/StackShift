# ADR 0010 — Cluster disk encryption, not Postgres TDE

**Status:** Accepted
**Date:** 2026-05-29
**Context:** Plan 09 §9.12 (Encryption at rest).

## Decision

StackSift relies on cluster-level disk encryption (LUKS on self-hosted nodes;
the cloud provider's EBS-encrypted / Persistent Disk-encrypted volumes on
managed clusters) for all stateful services — Postgres, Elasticsearch,
MinIO, RabbitMQ. **We do not enable Postgres Transparent Data Encryption.**

## Why not TDE?

1. **Postgres has no first-class TDE.** Every option (`pg_tde`, `cybertec/pg_tde`,
   commercial forks) adds operational complexity: a custom build of the
   server binary, a separate key manager handshake at startup, recovery
   surgery on every minor-version upgrade, and a smaller community for
   debugging.
2. **The threat TDE defends against is already addressed.** TDE protects
   data when the *disk* leaves the data centre — stolen laptops, RMA'd
   drives, decommissioned arrays. Cluster-level disk encryption covers
   the exact same threat with a single, well-understood primitive
   (LUKS / dm-crypt or the cloud provider's KMS), and the cloud
   primitives integrate cleanly with our hardware-rooted KMS keys.
3. **Marginal benefit on the in-cluster threat.** TDE does **not** protect
   against an attacker with `pg_read_server_files` or a session into a
   running Postgres process — the keys are loaded into the process address
   space at startup. The defences against an attacker who is *already in*
   the process are network controls, IAM, audit, and least-privilege —
   not encryption-at-rest.
4. **Backup encryption is handled separately.** `pgBackRest` configures
   `repo1-cipher-type=aes-256-cbc` with a cipher passphrase loaded from
   the same KMS — the backup repository is encrypted independently of
   whatever the live cluster does on disk.

## What "cluster-level disk encryption" specifically means

- **Cloud (managed Kubernetes):** all Persistent Volumes use the cloud
  provider's default encrypted storage class, with the KMS key under
  customer (not provider) control. AWS: `gp3` with `kms:key/...`.
  GCP: `pd-balanced` with `cmek_settings.kms_key_name`.
- **Self-hosted:** every node's data partition is LUKS-encrypted; the
  passphrase is fetched at boot from a Vault Transit endpoint or an
  HSM. Node decommission shreds the LUKS header before the disk leaves
  the rack.
- **Backups:** `pgBackRest` cipher key, MinIO SSE-KMS master key, and
  the ES snapshot bucket SSE-KMS key are three separate keys under
  three separate IAM principals. A compromise of one does not unlock
  the others.

## Encryption in transit (covered elsewhere — listed for completeness)

- **External:** TLS termination at the ingress (Plan 12's chart owns the
  cert-manager + ingress wiring). Minimum TLS 1.2, prefer 1.3, HSTS
  with preload.
- **Internal cluster traffic:** Plan 04 §4.x flags mTLS via a service
  mesh as a post-k8s decision; this ADR does not pre-commit to Istio vs.
  Linkerd.
- **Database/broker/cache:** Postgres `Ssl Mode=Require;Trust Server
  Certificate=false`. Elasticsearch `https://`. RabbitMQ `amqps://`.
  Redis `rediss://`. All wired via env in production and validated by
  the connection-string smoke test on every deploy.

## Consequences

- The security questionnaire answer to "do you encrypt data at rest?" is
  "yes — at the volume layer, with customer-managed KMS keys. We do not
  enable Postgres TDE because the threat is covered by the volume
  primitive; see ADR 0010."
- The annual penetration-test scope includes verifying that a copied
  `postgres-data` PV from a live cluster is unreadable when mounted in
  isolation.
- Master encryption keys (pgBackRest cipher, MinIO SSE-KMS, ES snapshot
  bucket) are exported offline quarterly per the procedure in
  `docs/runbooks/master-key-offline-backup.md`.

## Revisit when

- A statutory change in any major jurisdiction mandates database-engine-
  layer encryption.
- The PostgreSQL community ships first-class TDE in a major release; at
  that point this ADR is re-evaluated against the new primitive's
  operational profile, not the current state of the third-party patches.
