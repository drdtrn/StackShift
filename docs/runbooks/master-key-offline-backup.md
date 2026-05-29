# Master key offline backup

**Cadence:** quarterly (calendar reminder on the first Monday of January,
April, July, October — operator may run it sooner after any KMS rotation).
**Time budget:** ~30 minutes.
**Owner:** the founder. Backup operator (second principal) must observe
the procedure once before it counts toward Plan 09 §9.12's acceptance.

> **Why this runbook exists.** Disk encryption (ADR 0010) makes every
> backup unreadable without the master key. If we lose all in-cluster
> copies of the KMS key — KMS account compromised, Vault corruption, an
> over-eager `terraform destroy` — we lose the ability to restore from any
> backup we ever took. The offline copy is the last-resort restore key.

## What is being backed up

Three keys, three IAM principals, three separate envelopes:

| Key                                 | Source                         | Used by                          |
|-------------------------------------|--------------------------------|----------------------------------|
| pgBackRest cipher passphrase        | KMS alias `stacksift/pgbackrest` | Postgres backup encryption       |
| MinIO SSE-KMS master                | KMS alias `stacksift/minio-sse` | All MinIO buckets (uploads, exports) |
| ES snapshot bucket SSE-KMS master   | KMS alias `stacksift/es-snapshots` | Elasticsearch SLM snapshots      |

The Keycloak realm export (Plan 09 §9.7) does not need a master key —
Argon2 hashes ride along with the realm JSON.

## Procedure (Shamir-split variant)

Decision 0.9 picked Shamir over a single sealed envelope so that no single
principal can read the offline copy. Threshold is 2-of-3.

### Step 1 — Export the KMS material

For each KMS key alias:

```bash
# AWS example. GCP / Vault Transit equivalents are documented inline.
aws kms get-public-key --key-id alias/stacksift/pgbackrest > pgbackrest.pub.json
aws kms describe-key      --key-id alias/stacksift/pgbackrest > pgbackrest.meta.json
# The private key material itself is not exportable from KMS by design —
# what we are preserving is the *intent* to re-create an identical key alias
# pointing at the recovery-imported material. See the disaster runbook
# (docs/runbooks/restore-drill.md §"KMS lost") for the recovery sequence.
```

For pgBackRest's cipher passphrase (which is NOT a KMS key — it is a
high-entropy string stored in the same secrets manager):

```bash
# Fetch from Vault / AWS Secrets Manager:
aws secretsmanager get-secret-value --secret-id stacksift/pgbackrest-cipher \
  --query SecretString --output text > pgbackrest.cipher.txt
```

### Step 2 — Shamir-split each secret

Using `ssss-split` (the `libssss` package) at threshold 2-of-3:

```bash
ssss-split -t 2 -n 3 -w "stacksift-pgbackrest" < pgbackrest.cipher.txt > shares.txt
```

### Step 3 — Distribute the shares

| Share number | Custodian        | Storage location                              |
|--------------|------------------|-----------------------------------------------|
| 1            | Founder          | Personal safe (home)                          |
| 2            | Backup operator  | Office vault (sealed envelope, signed)        |
| 3            | Notary           | Notary office safe deposit box                |

Each share is printed on archival paper (not stored digitally). Custodians
sign + date the envelope on receipt; the founder logs the envelope serial
number and SHA-256 of the printed share in `docs/runbooks/master-key-log.md`
(itself committed only as a placeholder — the real log lives in a separate
private repo).

### Step 4 — Verify

Immediately after distribution, reconstitute the secret from any two
shares and confirm the SHA-256 matches the original input. Burn the
reconstituted secret on the verification machine.

### Step 5 — Calendar the next rotation

Schedule the next run on the operator's calendar with a hard deadline.
Missing this cadence is a P2 — the security review at quarter-end checks
that the runbook has been executed.

## When you need to restore from offline

See `docs/runbooks/restore-drill.md` (committed by Plan 13). This file's
purpose is the *backup* side — the restore choreography lives in the drill
runbook because the steps differ per KMS provider.

## Audit trail

Each execution records:
- Date + time
- Custodians involved
- Output SHA-256 (matches step 4 verification)
- Time-to-complete vs. the 30-minute budget

The log is kept in the founder-only repo to avoid leaking custodian
identities — committing a sample row here would defeat the purpose.
