# Lockfile & dependency audit (Plan 08 §15)

Defense against vulnerable and surprising transitive dependencies. Automated
scanning (Dependabot, Trivy, Dockle) runs continuously; this doc covers the
manual quarterly review and the on-demand commands.

## Automated (already in CI)

- **Dependabot** (`.github/dependabot.yml`) — weekly PRs for NuGet, the three
  npm packages (frontend, marketing, winston-transport), Dockerfiles; monthly
  for GitHub Actions.
- **Trivy + Dockle** (`.github/workflows/docker-build.yml`) — every image is
  scanned at `HIGH,CRITICAL` (Trivy, `exit-code 1`, honoring `.trivyignore`) and
  `FATAL` (Dockle) before it is published to GHCR.
- **GitHub Advanced Security** — code scanning + secret scanning enabled at the
  org level. We rely on GHAS + Dependabot for v1 and do **not** pay for Snyk;
  re-evaluate after the first 10 customers if the false-positive rate is high.

## On-demand commands

Backend (run from `src/backend`):

```bash
dotnet list package --vulnerable --include-transitive
dotnet list package --outdated
```

Frontend / marketing / SDK (pnpm):

```bash
pnpm --filter ./src/frontend audit --audit-level=high
pnpm --filter ./src/marketing audit --audit-level=high
pnpm --filter ./sdks/winston-transport audit --audit-level=high
pnpm why <package>   # investigate why a surprising transitive dep is present
```

## Quarterly review checklist

- Run the commands above; triage any `high`/`critical` advisories.
- Skim the transitive tree for packages with surprising names or maintainership
  changes (`pnpm why`, `dotnet list package --include-transitive`).
- Confirm every entry still in `.trivyignore` has a current justification and a
  re-evaluation trigger; drop entries whose upstream fix has shipped.
- Record the review date and findings in `docs/security/log.md`.
