using System.Text.Json;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace StackSift.Api.Health;

public static class HealthCheckJsonResponseWriter
{
    public static Task WriteAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json";

        var payload = new
        {
            status = report.Status.ToString(),
            totalDuration = report.TotalDuration.TotalMilliseconds,
            entries = report.Entries.ToDictionary(
                entry => entry.Key,
                entry => new
                {
                    status = entry.Value.Status.ToString(),
                    description = entry.Value.Description,
                    duration = entry.Value.Duration.TotalMilliseconds,
                    error = entry.Value.Exception?.Message,
                    data = entry.Value.Data,
                }),
        };

        return context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }
}
