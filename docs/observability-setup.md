# Observability Setup

Start the local stack from `infrastructure/docker`:

```bash
docker compose up -d --wait
```

Prometheus scrapes the API at `/metrics`, RabbitMQ at `:15692`, and postgres-exporter at `:9187`. Grafana is available at `http://localhost:3001`; dashboards are provisioned into the `StackSift` folder from `infrastructure/docker/grafana/dashboards`.

Health endpoints:

```bash
curl http://localhost:5190/health/live
curl http://localhost:5190/health/ready
curl http://localhost:5190/health/startup
curl http://localhost:3000/api/health
curl http://localhost:3000/api/healthz
```

Apply Elasticsearch lifecycle policy and template:

```bash
ES_URL=http://localhost:9200 ./scripts/apply-elasticsearch-ilm.sh
```

Uptime Kuma monitor setup is documented in `docs/uptime-kuma-bootstrap.md`. SLO definitions and burn-rate alert rationale are in `docs/slo.md`.
