using System.Net.Sockets;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace StackSift.Api.Health;

public sealed class RabbitMqReadyHealthCheck(IConfiguration configuration) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var host = configuration["RabbitMq:Host"] ?? "localhost";
        var port = int.TryParse(configuration["RabbitMq:Port"], out var parsedPort)
            ? parsedPort
            : 5672;

        using var client = new TcpClient();
        await client.ConnectAsync(host, port, cancellationToken);

        return HealthCheckResult.Healthy("RabbitMQ is reachable.");
    }
}
