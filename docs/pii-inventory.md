# PII inventory and data classification

Canonical list of every column StackSift stores that qualifies as personal
data under GDPR. The privacy policy (Plan 11 §3) and the audit response
(Plan 11 §10) reference this table verbatim — drift between this file and
those surfaces is a bug.

If you add a column that holds anything in the **Confidential** or
**Restricted** classes, add a row here in the same commit and update both
downstream surfaces in the same release.

| Entity / Column                       | Classification | Purpose                       | Retention                 | Encryption    |
|---------------------------------------|----------------|-------------------------------|---------------------------|---------------|
| `users.email`                         | Confidential   | Identity, billing receipts    | Until account deletion    | TLS in transit, disk at rest |
| `users.full_name`                     | Confidential   | UI personalisation            | Until account deletion    | TLS, disk     |
| `users.last_login_ip`                 | Confidential   | Abuse detection               | 90 days (rolling)         | TLS, disk     |
| `invitations.email`                   | Confidential   | Pending invite delivery       | Until accepted or 30 days | TLS, disk     |
| `audit_log_entries.actor_email`       | Confidential   | Audit trail                   | 365 days (then scrubbed)  | TLS, disk     |
| `audit_log_entries.actor_ip`          | Confidential   | Abuse / forensics             | 365 days                  | TLS, disk     |
| `log_entries.message`                 | Confidential\* | Core product function         | Per tier (3/30/90 d)      | TLS, disk     |
| `ai_analyses.input_context`           | Confidential\* | RAG embedding input           | Indefinite for active org | TLS, disk     |
| `stripe_customer.id`, `subscription.*`| Restricted     | Billing reconciliation        | 7 years (legal)           | TLS, disk     |
| `keycloak.users.credentials`          | Restricted     | Authentication                | Until account deletion    | Argon2 hash   |
| `log_sources.key_hash`                | Restricted     | Ingestion authentication      | Until log source deleted  | HMAC-SHA256 with pepper |

\* **Customer-controlled.** Customers may inadvertently log PII of *their*
end-users in `log_entries.message` or pass it into the RAG context. The DPA
(Plan 11 §5) treats this as a controller-controlled risk under GDPR Article
28 — StackSift is the processor; the customer is the controller of any PII
their logs contain. We provide guidance and tooling
(`PiiRedactionEnricher` sample below) but do not enable server-side
redaction by default — see `docs/adr/0009-no-server-side-log-redaction.md`.

## Classification key

- **Confidential** — Identifying information that, if leaked, would harm
  the data subject's privacy or expose them to abuse. Stored encrypted at
  rest, transmitted over TLS, accessible only via authenticated API.
- **Restricted** — Credentials, billing identifiers, and authentication
  material whose leak would let an attacker impersonate the data subject
  or charge their card. Stored hashed where possible (Argon2 for passwords,
  HMAC-SHA256-with-pepper for API keys). Never logged.

## What "Until account deletion" means

When a user issues `DELETE /api/v1/account` (Plan 09 §9.9 / Phase 10), the
soft-delete fires immediately. After the 30-day grace window, the
`AccountErasureJob` removes the row. The retention floor for audit and
Stripe records (365 days / 7 years) overrides the per-user retention for
the regulatory-required tables; in that case the actor identifiers are
anonymised but the row IDs are preserved.

## Cross-references

- Server-side redaction policy: `docs/adr/0009-no-server-side-log-redaction.md`
- Retention by tier: `docs/retention.md`
- GDPR endpoints (export + erasure): Plan 09 §9.8 / §9.9
- Privacy policy surface: Plan 11 §3 (`docs/legal/privacy.md`, forthcoming)
