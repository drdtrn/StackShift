# Loki — Setup & Troubleshooting

StackSift ships log lines to Loki via `Serilog.Sinks.Grafana.Loki`.
Loki is auto-provisioned in Grafana as a datasource on boot.

## Run locally

```bash
cd infrastructure/docker && docker compose up -d loki grafana
```

Open Grafana at <http://localhost:3001> (admin / admin_secret) → Explore → Loki.

## Find logs for a single request

```logql
{app="stacksift"} | json | CorrelationId="<paste-uuid-here>"
```

## Useful queries

```logql
{app="stacksift", level="error"}
{app="stacksift"} |= "LogBatchConsumer"
```

## Override the Loki URL

Set `Serilog:Loki:Url` in `appsettings.*.json` or `Serilog__Loki__Url` as an env var.
Empty/missing = Loki sink skipped silently; console sink continues.
