using Elastic.Clients.Elasticsearch;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace StackSift.Api.Health;

public sealed class ElasticsearchReadyHealthCheck(ElasticsearchClient client) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var response = await client.PingAsync(cancellationToken);

        return response.IsValidResponse
            ? HealthCheckResult.Healthy("Elasticsearch is reachable.")
            : HealthCheckResult.Unhealthy(
                "Elasticsearch ping failed.",
                data: new Dictionary<string, object>
                {
                    ["debugInformation"] = response.DebugInformation,
                });
    }
}
