# StackSift SLOs

StackSift v1 tracks three service-level indicators:

| SLI | Query shape | Target |
|-----|-------------|--------|
| API request latency | Percentage of API requests completed under 1 second | 99.0% |
| Log ingest success | Percentage of ingest requests not returning 5xx | 99.9% |
| AI analysis SLA | Percentage of analyses completed within 60 seconds | 95.0% |

The targets bias toward operational usefulness over false precision. API latency and ingest success protect the core product loop, while AI analysis duration protects the paid feature that turns logs into incident context.

Burn-rate alerts live in `infrastructure/docker/prometheus/rules/stacksift.yml` with 1h fast-burn and 6h slow-burn windows. The fast window pages on rapid budget exhaustion; the slow window catches sustained degradation before users report it.

Retention numbers for customer log data come from Plan 09 section 9.6. Incident-response routing and escalation steps are a forward reference to Plan 12.
