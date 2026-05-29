using System.Diagnostics;
using System.Security.Claims;
using Serilog.Context;

namespace StackSift.Api.Middleware;

public sealed class ObservabilityEnrichmentMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var activity = Activity.Current;
        var orgId = context.User.FindFirstValue("organization_id");
        var userId = context.User.FindFirstValue("sub")
            ?? context.User.FindFirstValue(ClaimTypes.NameIdentifier);

        using var traceId = LogContext.PushProperty("TraceId", activity?.TraceId.ToString());
        using var spanId = LogContext.PushProperty("SpanId", activity?.SpanId.ToString());
        using var organization = LogContext.PushProperty("OrgId", orgId);
        using var user = LogContext.PushProperty("UserId", userId);

        await next(context);
    }
}
