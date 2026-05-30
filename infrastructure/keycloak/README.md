# Keycloak realm config

## `stacksift-realm.json` — LOCAL DEV SEED ONLY

This file is imported on the **first boot** of the compose Keycloak
(`docker compose up`) to seed a working realm for local development and the
`backup-smoke` profile. It is **not** the production source of truth.

**Production / staging realm config lives in
[`infrastructure/terraform/keycloak/`](../terraform/keycloak/)** (the
`keycloak/keycloak` Terraform provider). The import JSON only runs once per
fresh database; any change made through the Keycloak admin UI is lost on the
next `docker compose down -v`. Terraform is idempotent and reproducible — use it
for anything beyond local dev.

The dev seed is kept roughly in parity with the Terraform realm so local testing
exercises the hardened settings: `verifyEmail`, `bruteForceProtected`,
`resetPasswordAllowed`, refresh-token rotation (`revokeRefreshToken`), a
server-side `passwordPolicy`, and SMTP wired to the in-stack **Mailpit**
(`mailpit:1025`, no auth) so verification / reset emails are catchable at
`http://localhost:8025`.

> The dev `passwordPolicy` intentionally matches the backend
> `RegisterUserCommandValidator` (length 12 + upper + lower + digit; no
> special-char requirement) so registration through the app does not fail Keycloak
> policy. The production Terraform may tighten this once the validator is aligned.
