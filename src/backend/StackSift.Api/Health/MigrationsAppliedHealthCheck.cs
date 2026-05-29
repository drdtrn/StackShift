using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Api.Health;

public sealed class MigrationsAppliedHealthCheck(AppDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var pending = await db.Database.GetPendingMigrationsAsync(cancellationToken);
        var pendingMigrations = pending.ToArray();

        return pendingMigrations.Length == 0
            ? HealthCheckResult.Healthy("Database migrations are applied.")
            : HealthCheckResult.Unhealthy(
                "Database has pending migrations.",
                data: new Dictionary<string, object>
                {
                    ["pendingMigrations"] = pendingMigrations,
                });
    }
}
