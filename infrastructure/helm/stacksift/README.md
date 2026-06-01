# StackSift Helm chart (namespace `project-07`, closed-beta)

Single-namespace deploy of all StackSift surfaces + dependencies. Built from the
research in `zhelpers/DEPLOY/`. Targets `life-cluster` / namespace `project-07`
(namespace-scoped admin only — no cluster-wide operators are installed by this
chart; it consumes the cluster's pre-installed **ECK** and **cert-manager**).

## What it deploys
- **Apps:** api, frontend (dashboard), marketing, + EF-migration hook Job
  (optional `cronworker` when api scales >1).
- **Stateful deps:** Postgres (custom pgvector image, shared DB with Keycloak),
  Redis, RabbitMQ, MinIO (+ bucket-init hook), Keycloak (realm-import), and
  Elasticsearch via the **ECK** `Elasticsearch` CR.
- **Ingress + TLS:** ingress-nginx + cert-manager namespaced ACME `Issuer`
  (HTTP-01), one host per surface under `dmdailydeals.com`.

## Prerequisites (do these BEFORE `helm install`)

1. **DNS** — A-records for `app. api. auth. @ www. files.dmdailydeals.com` → the
   four worker IPs (`159.69.8.132, 159.69.2.83, 159.69.16.208, 159.69.5.128`).
2. **kubectl/helm context** → `project-07`:
   ```bash
   export KUBECONFIG=~/Downloads/project-07.kubeconfig
   kubectl config current-context   # → project-07
   ```
3. **App secret** (NOT templated — keep values out of git):
   ```bash
   kubectl -n project-07 create secret generic stacksift-secrets \
     --from-env-file=$HOME/.config/stacksift-deploy/secrets.env
   ```
4. **Keycloak realm secret** — substitute the backend-admin client secret, then load:
   ```bash
   SECRET=$(grep '^KC_BACKEND_ADMIN_CLIENT_SECRET=' ~/.config/stacksift-deploy/secrets.env | cut -d= -f2-)
   sed "s/REPLACE_AT_RUNTIME/${SECRET}/" infrastructure/keycloak/stacksift-realm.json > /tmp/stacksift-realm.json
   # Point the public client redirect/web-origin at the real domain (verify/adjust):
   #   sed -i 's#http://localhost:3000#https://app.dmdailydeals.com#g' /tmp/stacksift-realm.json
   kubectl -n project-07 create secret generic stacksift-realm \
     --from-file=stacksift-realm.json=/tmp/stacksift-realm.json
   rm -f /tmp/stacksift-realm.json
   ```
   ⚠️ The realm JSON's `stacksift-frontend` client **Valid Redirect URIs** and
   **Web Origins**, and `stacksift-api` settings, must include the
   `https://*.dmdailydeals.com` hosts or login/CORS will fail. Verify before loading.
5. *(Only if `elasticsearch.snapshots.enabled=true`)* ES S3 creds for snapshots:
   ```bash
   MK=$(grep '^MINIO_ROOT_USER=' ~/.config/stacksift-deploy/secrets.env | cut -d= -f2-)
   MS=$(grep '^MINIO_ROOT_PASSWORD=' ~/.config/stacksift-deploy/secrets.env | cut -d= -f2-)
   kubectl -n project-07 create secret generic stacksift-es-s3-creds \
     --from-literal=s3.client.default.access_key="$MK" \
     --from-literal=s3.client.default.secret_key="$MS"
   ```

## Install / upgrade
```bash
helm upgrade --install stacksift infrastructure/helm/stacksift \
  -n project-07 -f infrastructure/helm/stacksift/values-beta.yaml
```
First run uses the **Let's Encrypt staging** issuer (`certIssuer.useStaging=true`)
— browsers will warn. Once the cert flow + smoke test pass, set `useStaging=false`
and re-run for trusted certs.

## Images
api/migrator/postgres use published GHCR tags as-is (runtime-configurable).
**frontend + marketing MUST be rebuilt** for `dmdailydeals.com` (Next bakes
`NEXT_PUBLIC_*` at build time; CI baked `*.stacksift.com`). See
`zhelpers/DEPLOY/06-images-and-registry`. Build args:
`NEXT_PUBLIC_API_URL=https://api.dmdailydeals.com`,
`NEXT_PUBLIC_KEYCLOAK_URL=https://auth.dmdailydeals.com`,
`NEXT_PUBLIC_APP_URL=https://app.dmdailydeals.com`,
`NEXT_PUBLIC_SIGNALR_HUB_URL=https://api.dmdailydeals.com/hubs/stacksift`,
`NEXT_PUBLIC_AUTH_MOCK=false`, `NEXT_PUBLIC_SIGNALR_MOCK=false`; marketing:
`NEXT_PUBLIC_APP_BASE_URL=https://app.dmdailydeals.com`. Push as tag `dmdailydeals`.

## Key design decisions (see zhelpers/DEPLOY for rationale)
- **Single api replica, role `api`** runs web + Hangfire cron (matches compose).
  Scaling >1 requires `api.role=web` + `cronworker.enabled=true`.
- **RLS role cutover active** (`Database__RlsRoleSwitching=true`): the app connects as
  `stacksift_app` (NOBYPASSRLS) so Postgres row-level security is enforced per request;
  the migrator runs as `stacksift_owner` via `ConnectionStrings__MigrationsConnection`;
  trusted background jobs/consumers `SET ROLE` to the owner for cross-org work. Keycloak
  still shares the `stacksift` DB on the bootstrap superuser (dedicated DB is Gate 3).
- **WAL archiving OFF** (`postgres.backups.enabled=false`) for Gate 2.
- **Elasticsearch security/http-TLS OFF** to match the app's plain-http ES client.
- **No Loki/Tempo** at Gate 2 → console logs only (`kubectl logs`).

## Uninstall
`helm uninstall stacksift -n project-07` removes workloads. **PVCs persist**
(delete manually if you want to wipe data). Pre-created Secrets are not managed by
Helm — delete them separately.
