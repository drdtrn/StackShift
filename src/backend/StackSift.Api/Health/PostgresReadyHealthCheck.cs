using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Api.Health;

public sealed class PostgresReadyHealthCheck(AppDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var canConnect = await db.Database.CanConnectAsync(cancellationToken);

        return canConnect
            ? HealthCheckResult.Healthy("Postgres is reachable.")
            : HealthCheckResult.Unhealthy("Postgres is unreachable.");
    }
}
