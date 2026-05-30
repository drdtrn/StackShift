# Keycloak realm as code (Plan 05 §5.1 / Gate-1)

Production / staging source of truth for the `stacksift` Keycloak realm. The
import JSON at `infrastructure/keycloak/stacksift-realm.json` is **local-dev seed
only** — this module is what reproduces the realm idempotently in the cluster.

## Decision G1.0 — managed via Terraform (not the Keycloak Operator)

This module manages the realm through the official **`keycloak/keycloak ~> 5.0`**
provider (the archived `mrparkers/keycloak` is not used). If the K8S-DEPLOY phase
adopts the Keycloak Operator (`KeycloakRealmImport` CRD) instead, revisit this
module. Record the choice in the PR description.

## What it creates

- `keycloak_realm.stacksift` — sessions/token lifetimes, refresh-token rotation
  (`revoke_refresh_token` + `refresh_token_max_reuse = 0`), `registration_allowed
  = false`, `verify_email = true`, `reset_password_allowed = true`, server-side
  `password_policy` (matches the backend validator), `ssl_required = "all"`,
  brute-force detection (10 failures / 15-min cap), optional SMTP.
- `verify_email` (default) + `configure_totp` (opt-in) required actions.
- Three OIDC clients with **exact** redirect URIs / web origins (no `*`):
  `stacksift-frontend` (PUBLIC + PKCE S256), `stacksift-api` (CONFIDENTIAL,
  service account), `stacksift-backend-admin` (CONFIDENTIAL, `full_scope_allowed`).
- Service-account `manage-users`/`view-users`/`query-users` grants for the
  backend-admin client.
- Realm event logging (`jboss-logging`) for the audit pipeline (Phase 9 consumes it).

## Apply (at the Hetzner deploy — needs a running in-cluster Keycloak)

```bash
# Bootstrap admin creds + state-backend creds come from Vault, never git.
export TF_VAR_kc_bootstrap_admin="$(vault kv get -field=admin_user secret/stacksift/keycloak)"
export TF_VAR_kc_bootstrap_password="$(vault kv get -field=admin_password secret/stacksift/keycloak)"

terraform init \
  -backend-config="bucket=stacksift-tfstate" \
  -backend-config="key=keycloak-prod.tfstate" \
  -backend-config="region=us-east-1" \
  -backend-config="endpoints={s3=\"https://<minio-endpoint>\"}" \
  -backend-config="access_key=<minio-key>" \
  -backend-config="secret_key=<minio-secret>"

terraform plan -var kc_base_url="https://auth.stacksift.com" \
               -var frontend_origin="https://app.stacksift.com"
terraform apply
```

## Local validation (no cluster needed)

```bash
terraform fmt -check
terraform init -backend=false && terraform validate
```

> **Status:** authored + offline-validated for Gate-1. The `terraform plan` /
> apply, idempotency (zero-diff re-plan), drift, and OIDC negative tests
> (`invalid_redirect_uri`, PKCE-required) run at the first staging apply against
> the in-cluster Keycloak — see partial-plan T4.
