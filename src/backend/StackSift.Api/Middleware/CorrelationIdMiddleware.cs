using Serilog.Context;

namespace StackSift.Api.Middleware;

/// <summary>Reads or generates an <c>X-Correlation-ID</c> per request, echoes it on the
/// response, and pushes it into the Serilog <c>LogContext</c> so every downstream log line
/// carries the same identifier.</summary>
public sealed class CorrelationIdMiddleware(RequestDelegate next)
{
    /// <summary>HTTP header used to propagate the correlation ID between client and server.</summary>
    public const string HeaderName = "X-Correlation-ID";

    /// <summary>Key under which the correlation ID is stored in <see cref="HttpContext.Items"/>.</summary>
    public const string ItemKey = "CorrelationId";

    /// <summary>ASP.NET Core middleware entry point.</summary>
    public async Task InvokeAsync(HttpContext ctx)
    {
        var correlationId =
            ctx.Request.Headers.TryGetValue(HeaderName, out var v)
            && Guid.TryParse(v, out var parsed)
                ? parsed.ToString()
                : Guid.NewGuid().ToString();

        ctx.Items[ItemKey] = correlationId;
        ctx.Response.Headers[HeaderName] = correlationId;

        using (LogContext.PushProperty("CorrelationId", correlationId))
            await next(ctx);
    }
}