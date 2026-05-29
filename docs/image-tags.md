# Container image tag taxonomy

Three images live at `ghcr.io/drdtrn/stacksift-{api,frontend,marketing}`. Tags are produced by `.github/workflows/docker-build.yml`.

| Tag                    | Pushed when                        | Purpose                                        |
|------------------------|------------------------------------|------------------------------------------------|
| `:sha-<short-sha>`     | every push (any branch)            | Precise pin for rollback / debugging           |
| `:develop`             | push to `develop`                  | "Current dev tip" — what staging tracks        |
| `:main`                | push to `main`                     | "Current main tip" — what prod tracks          |
| `:v<MAJOR>.<MINOR>.<PATCH>` | git tag `v*.*.*` push          | Immutable release                              |
| `:<MAJOR>.<MINOR>`     | git tag `v*.*.*` push              | Floating "current minor" (e.g. `0.1`)          |
| `:latest`              | git tag `v*.*.*` push              | Floating "latest stable" — for casual pulls    |

No tag is moved retroactively. Once `:sha-abc1234` ships, it is forever those bytes.

`:latest` and `:develop` are *intentionally distinct* — we never let a casual `docker pull` resolve to dev code. CI deploys (k8s, folder 12) target `:sha-<short>` exclusively so rollback is `kubectl set image deployment/api api=ghcr.io/.../stacksift-api:sha-<previous>`.

## Pull-request builds

PR runs build the images and run Trivy + Dockle locally (no push). Findings fail the check; the registry is untouched. This keeps review traffic out of GHCR without losing the security gate.

## Pulling

```bash
docker pull ghcr.io/drdtrn/stacksift-api:sha-abc1234
docker pull ghcr.io/drdtrn/stacksift-api:develop
docker pull ghcr.io/drdtrn/stacksift-api:latest    # only resolves once v*.*.* lands
```

Images are public per Plan 04 Decision 0.5 — no `imagePullSecret` needed in k8s.
