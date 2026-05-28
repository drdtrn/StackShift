# StackSift SDK Versioning & Deprecation Policy

This document governs all StackSift-authored SDKs:

- **`StackSift.Serilog.Sink`** — NuGet, .NET
- **`@stacksift/winston-transport`** — npm, Node.js
- Future SDKs (OpenTelemetry exporter, Python SDK, Go SDK, etc.) will be added to this list as they ship.

## Versioning scheme

All StackSift SDKs follow [Semantic Versioning 2.0](https://semver.org/):

- **MAJOR** (`X.0.0`) — breaking change to public API or wire shape.
- **MINOR** (`0.X.0`) — backward-compatible feature addition.
- **PATCH** (`0.0.X`) — backward-compatible bug fix.

## What "public API" means

For each SDK, the public surface is:

- **`StackSift.Serilog.Sink`** — types and methods marked `public`, plus the shape of the JSON payload posted to `/api/v1/logs/ingest`.
- **`@stacksift/winston-transport`** — types and functions re-exported from `index.ts`, plus the same wire shape.

The wire shape is co-owned with the backend's `IngestLogBatchCommand` / `IngestLogEntryDto`. **Backend additions to those types must be optional**; SDK additions to constructor options must be optional.

Anything not in the lists above (helpers in internal namespaces, package-private utilities, file/folder structure of `dist/`) is fair game to refactor without a version bump.

## Pre-1.0

While an SDK is on a `0.x` line, **minor-version bumps may include breaking changes** — the changelog calls each one out explicitly. This freedom is for the period when the wire shape is still evolving with the backend.

An SDK graduates from `0.x` to `1.0.0` when:

1. At least one external customer has run it in production unchanged for 30 days.
2. There are no open breaking-change issues against the public API.
3. The corresponding backend endpoint contract in [api-reference.md](./api-reference.md) has not changed in 30 days.

After `1.0.0`, the SemVer rules are strict.

## Deprecation lifecycle

1. **Mark deprecated** in code (`[Obsolete]` attribute on .NET, `@deprecated` JSDoc on TypeScript) and in the changelog. A deprecation specifies the replacement and a target removal date **no sooner than 6 months out**.
2. **Warn at runtime** when a deprecated option is used: one log line per process, suppressible with an opt-in env var (`STACKSIFT_SUPPRESS_DEPRECATION=1`).
3. **Remove** the deprecated option in the next MAJOR release on or after the target removal date.

## Support matrix

| SDK                              | Latest      | Status   | Bugfix support until           |
|----------------------------------|-------------|----------|--------------------------------|
| `StackSift.Serilog.Sink`         | `0.1.0`     | Current  | superseded by `1.0.0` once ready |
| `@stacksift/winston-transport`   | `0.1.0`     | Current  | superseded by `1.0.0` once ready |

This table is updated at every release.

## Pre-release tagging

- `@stacksift/winston-transport@0.2.0-beta.1` for npm pre-releases (`--tag beta` on publish).
- `StackSift.Serilog.Sink 0.2.0-beta1` for NuGet pre-releases (versions containing a hyphen are treated as pre-release by NuGet's default views).

Pre-releases are not promoted to `latest` on the registries until the corresponding final version ships.

## Reporting breakage

If a version bump breaks your integration in a way the changelog didn't anticipate, open an issue at <https://github.com/drdtrn/StackSift/issues> with the SDK name, version, and a minimal reproducer. SDK regressions are treated as P1 — fix or revert within one business day.
