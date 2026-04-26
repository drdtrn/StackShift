using Serilog.Context;

namespace StackSift.Api.Middleware;

public sealed class CorrelationIdMiddleware(RequestDelegate next)
{
    public const string HeaderName = "X-Correlation-ID";
    public const string ItemKey = "CorrelationId";

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