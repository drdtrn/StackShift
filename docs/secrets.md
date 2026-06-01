# Secrets

Three places a value can live:

1. **Hardcoded** — `appsettings.json`. Only safe for non-secret defaults
   (URLs, batch sizes, feature flags). Never put a token here.
2. **`dotnet user-secrets`** — the per-developer secrets store. Lives on
   disk at `~/.microsoft/usersecrets/<UserSecretsId>/secrets.json` and is
   automatically loaded by the host in `Development` mode. Use this for
   real keys you don't want to type each time on your own laptop.
3. **Environment variables** — the production surface. ASP.NET Core binds
   `Section__Subsection__Key` env vars onto `appsettings.json`'s
   `Section:Subsection:Key`. The docker-compose stack and (later) the k8s
   manifests both inject secrets this way.

Secrets are **never** committed. `.env.local` is gitignored;
`appsettings.Development.json` carries only dev-mode behaviour switches.
`appsettings.Production.json` is intentionally minimal — it just sets the
log levels — because every meaningful value flows from env at deploy time.

## Bootstrap

Copy the template and fill in the marked values:

```bash
cp .env.example .env.local
# edit .env.local; replace every CHANGE_ME
```

For local-host (non-docker) dev, the same values go into user-secrets:

```bash
dotnet user-secrets set "Stripe:ApiKey" "sk_test_..." \
    --project src/backend/StackSift.Api
dotnet user-secrets set "OpenAI:ApiKey" "sk-..." \
    --project src/backend/StackSift.Api
dotnet user-secrets set "Keycloak:Admin:AdminClientSecret" "..." \
    --project src/backend/StackSift.Api
```

## Env → appsettings mapping

ASP.NET Core's `:`/`__` mapping convention applies to every value below.
`Stripe__ApiKey=sk_live_...` overrides `Stripe:ApiKey`.

| env var (production) | appsettings.json path | Source |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | `ConnectionStrings:DefaultConnection` | runtime — **`Username=stacksift_app`** (NOBYPASSRLS) when `Database__RlsRoleSwitching=true` |
| `ConnectionStrings__MigrationsConnection` | `ConnectionStrings:MigrationsConnection` | migrator — **`Username=stacksift_owner`** (BYPASSRLS); falls back to `DefaultConnection` if unset |
| `Elasticsearch__Uri` | `Elasticsearch:Uri` | runtime |
| `Redis__ConnectionString` | `Redis:ConnectionString` | runtime |
| `RabbitMq__Host` | `RabbitMq:Host` | runtime |
| `RabbitMq__User` / `__Password` | `RabbitMq:User` / `:Password` | runtime |
| `Smtp__Host` / `__Port` / `__UseSsl` | `Smtp:*` | runtime |
| `App__FrontendBaseUrl` | `App:FrontendBaseUrl` | runtime |
| `Storage__S3__*` | `Storage:S3:*` | runtime |
| `Serilog__Loki__Url` | `Serilog:Loki:Url` | runtime |
| `Keycloak__AuthServerUrl` | `Keycloak:AuthServerUrl` | runtime |
| `Keycloak__Realm` | `Keycloak:Realm` | runtime |
| `Keycloak__Resource` | `Keycloak:Resource` | runtime |
| `Keycloak__Credentials__Secret` | `Keycloak:Credentials:Secret` | **secret** |
| `Keycloak__Admin__*` | `Keycloak:Admin:*` | runtime + **secret** for `AdminClientSecret` |
| `Stripe__ApiKey` | `Stripe:ApiKey` | **secret** |
| `Stripe__WebhookSecret` | `Stripe:WebhookSecret` | **secret** |
| `Stripe__Prices__Indie` / `__Team` | `Stripe:Prices:*` | runtime |
| `OpenAI__ApiKey` | `OpenAI:ApiKey` | **secret** |
| `LogSources__KeyPepperBase64` | `LogSources:KeyPepperBase64` | **secret** |

`**secret**` entries are the ones to gate behind your secret manager in
production (Plan 08 §9 picks the manager — External Secrets Operator is
the working assumption).

## Frontend secrets

Two distinct kinds:

- **`NEXT_PUBLIC_*`** — baked into the client bundle at build time. NOT a
  secret: anything prefixed `NEXT_PUBLIC_` is visible in browser DevTools.
  Use this for non-sensitive URLs (`NEXT_PUBLIC_API_URL`).
- **Server-only env** — read by route handlers and server components,
  never reaches the client bundle. The Keycloak client secret, session
  cookie secret, and `KEYCLOAK_INTERNAL_URL` live here.

Because `NEXT_PUBLIC_*` bakes at build time, we build one image per env
(staging, production). Server-only env values change without rebuilding.

## Log Source Key Pepper

Log source API keys are HMAC-SHA-256 hashed with a deployment pepper. The
API fails at startup if the pepper is missing or decodes to fewer than
32 bytes.

Generate:

```bash
openssl rand -base64 32
```

Set for local dev (one of):

```bash
# Option 1 — user-secrets (host-mode dev)
dotnet user-secrets set "LogSources:KeyPepperBase64" "<base64>" \
    --project src/backend/StackSift.Api

# Option 2 — env var (docker-compose dev)
echo "LogSources__KeyPepperBase64=<base64>" >> .env.local
```

**Rotation:** rotating the pepper invalidates every existing log-source
API key in one shot. Customers receive 401s until they regenerate keys
in the dashboard. Production only rotates on suspected compromise; the
runbook is in Plan 12 §10.

## Stripe webhook secrets

Stripe sends webhooks with an `X-Signature` header. `Stripe__WebhookSecret`
must match the secret bound to the destination URL in Stripe's dashboard.
The local `stripe listen --forward-to ...` command prints the secret on
first run; copy it into `.env.local`.

## Production secret store (deferred)

Plan 08 §9 picks the secret store. The working assumption is **External
Secrets Operator** with the cloud KMS as the backing store (AWS Secrets
Manager / GCP Secret Manager). The ASP.NET Core env-var surface above is
the contract — only the *source* of the values changes when we deploy.

## TLS (production-only)

Production deployments require TLS on every dependency connection.
`appsettings.Production.json` is intentionally sparse on these — the
canonical values live in env at deploy time. The strings below are the
minimum each connection must satisfy:

| Service          | Env var                                         | Required suffix / flag                                          |
|------------------|-------------------------------------------------|-----------------------------------------------------------------|
| Postgres         | `ConnectionStrings__DefaultConnection`          | `Ssl Mode=Require;Trust Server Certificate=false`                |
| Elasticsearch    | `Elasticsearch__Uri`                            | `https://`                                                       |
| RabbitMQ         | `RabbitMq__Host`                                | `amqps://` (or `amqps` scheme via `Uri`)                         |
| Redis            | `Redis__ConnectionString`                       | `ssl=true` (StackExchange.Redis flag) — the URI scheme is moot   |
| MinIO / S3       | `Storage__S3__Endpoint`                         | `https://` with SSE-KMS as the bucket default                    |
| SMTP             | `Smtp__UseSsl`                                  | `true`; STARTTLS on port 587 or implicit TLS on 465              |

Misconfiguration in production must be caught at boot, not silently
permitted: the connection-string smoke test in `IHostedService`
startup hooks (see `EsLifecycleBootstrap` for the pattern) rejects
non-TLS endpoints when `ASPNETCORE_ENVIRONMENT=Production`.

Encryption-at-rest posture and the offline-backup procedure for the
master keys live in `docs/adr/0010-cluster-disk-encryption-not-pg-tde.md`
and `docs/runbooks/master-key-offline-backup.md` respectively.
