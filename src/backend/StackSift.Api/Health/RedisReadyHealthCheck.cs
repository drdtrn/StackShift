using Microsoft.Extensions.Diagnostics.HealthChecks;
using StackExchange.Redis;

namespace StackSift.Api.Health;

public sealed class RedisReadyHealthCheck(IConnectionMultiplexer redis) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var db = redis.GetDatabase();
        await db.PingAsync();

        return HealthCheckResult.Healthy("Redis is reachable.");
    }
}
