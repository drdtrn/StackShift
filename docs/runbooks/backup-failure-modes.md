# Backup failure modes

Catalogue of the things that go wrong with pgBackRest + the off-site
replication, with the response for each. Surfaced from Plan 09 §9.10
and the first restore-drill walkthrough.

If you are in an incident and the symptom isn't listed here, treat the
restore as P1, page the founder, and add a new row to this file when
the incident closes.

## 1. WAL gap

**Symptom.** `pgbackrest --type=time --target='...'` errors with
"unable to find WAL segment 0000...". `pgbackrest info` shows
`archive` column with a hole.

**Cause.** `archive_command` failed silently for some window —
usually because the off-site bucket was unreachable, IAM credentials
expired, or the bucket policy changed. Postgres holds onto WAL until
`archive_command` succeeds, then evicts it; once evicted from
`pg_wal/`, the WAL is unrecoverable unless we have an off-site copy
that captured it.

**Response.**
1. Restore to the last known continuous WAL: trim the `--target`
   timestamp back to the last hour for which the `archive` column is
   contiguous. Customer data between the gap start and that timestamp
   is lost — file a customer-facing notice.
2. Root cause the archive failure: check the Postgres logs around the
   gap window for `archive_command failed` messages. Fix the
   underlying cause (IAM, bucket policy, network) before retrying.
3. Take a fresh full backup immediately so the next PITR window starts
   fresh.

## 2. Repository corruption

**Symptom.** `pgbackrest check` reports "repo1 file [...] checksum
invalid" or "manifest decode failed". `pgbackrest restore` fails part
way through.

**Cause.** Disk error on the primary backup repo, partial S3 upload
that wasn't checksum-validated, or an aborted `pgbackrest expire`
that left a torn manifest.

**Response.**
1. **Do not retry on the primary repo** — that risks compounding the
   corruption. Switch to the off-site replica:
   ```bash
   pgbackrest --stanza=stacksift --repo=2 --type=time --target='...' restore
   ```
   The `--repo=2` flag is wired in `infrastructure/pgbackrest/pgbackrest.conf`
   under the `[global]` section (set `repo2-type` etc. for the off-site
   bucket).
2. After the restore, run `pgbackrest --stanza=stacksift verify` on the
   primary repo to scope the corruption. Anything past the corruption
   marker has to be re-taken from a fresh full backup.
3. If the corruption is in the off-site repo too: see §3.

## 3. Off-site replica is gone or unreachable

**Symptom.** `pgbackrest --repo=2 info` errors with "unable to read";
the off-site bucket lifecycle was changed, the IAM principal was
revoked, or the backup account itself was compromised.

**Response.**
1. Stop the replication CronJob immediately so a compromised account
   cannot mirror the next full backup overwriting whatever survives.
2. If the off-site is unreachable but the primary is healthy: this is
   downgraded to a P3. Open the access path, resume replication.
3. If both repos are compromised: see §4.

## 4. KMS / encryption key lost or unusable

**Symptom.** `pgbackrest restore` errors with "unable to decrypt
file [...] passphrase incorrect" — meaning we have the bytes but
cannot read them.

**Response — graceful path.**
1. Try the in-cluster KMS first: the cipher passphrase is stored in
   AWS Secrets Manager / Vault Transit; check whether the principal
   accessing it has the right IAM policy.
2. Try the operator's local cached copy of the cipher passphrase
   (the `pgbackrest-init` runs of the past 90 days will have written
   it to the operator's shell history under audit).

**Response — last-resort path.**
3. Reconstitute the cipher passphrase from the Shamir-split offline
   backup (`docs/runbooks/master-key-offline-backup.md`). Reaching
   here means at least two of the three custodians coordinate; the
   founder is one of them.
4. After reconstitution: rotate the KMS key, take a fresh full backup
   under the new key, decommission the old encrypted backup chain.
   The old chain is left in place (encrypted with the lost key) only
   so we have a tombstone for the audit trail.

## 5. Restore SLA missed

**Symptom.** The drill or real restore takes longer than the 30-minute
RTO documented in the security page (Plan 11 §8).

**Response.**
1. Document the actual time in `docs/runbooks/restore-drill-rto-log.md`
   (real-run only — drills capture in the PR description).
2. If the deviation is > 20% over the SLA: update the security-page
   number to match measured reality, then file a follow-up ticket to
   investigate why (network egress throttling, repo size growth past
   the assumption, off-site latency).
3. Customer commitments published in the marketing site change in
   lockstep — drift is a security-page bug.

## Cross-references

- `docs/runbooks/restore-drill-tabletop.md` — the drill itself.
- `docs/runbooks/master-key-offline-backup.md` — the Shamir-split key
  recovery procedure.
- ADR 0010 — encryption posture (why the master keys matter).
- Plan 09 §9.10 — the founding text for this runbook.
