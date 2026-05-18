using System.Text.Json;

namespace StackSift.Api.Middleware;

/// <summary>Standard error envelope returned by the API for all 4xx/5xx responses.</summary>
/// <param name="Type">URI reference identifying the problem type (e.g. <c>https://httpstatuses.io/404</c>).</param>
/// <param name="Title">Short human-readable summary (e.g. <c>"Not Found"</c>).</param>
/// <param name="Status">HTTP status code repeated in the body for client convenience.</param>
/// <param name="Detail">Free-form explanation of this specific occurrence; may be null.</param>
/// <param name="TraceId">The request's correlation ID, when one was assigned.</param>
/// <param name="Errors">Field-level validation errors for 400 responses, keyed by camelCased field name.</param>
public sealed record ApiErrorResponse(
    string Type,
    string Title,
    int Status,
    string? Detail,
    string? TraceId,
    IReadOnlyDictionary<string, string[]>? Errors);

internal static class JwtProblemDetailsHelper
{
    internal static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DictionaryKeyPolicy = JsonNamingPolicy.CamelCase,
    };

    public static Task WriteAsync(HttpContext ctx, int status, string title)
    {
        var traceId = ctx.Items[CorrelationIdMiddleware.ItemKey] as string;
        var body = new ApiErrorResponse(
            Type: $"https://httpstatuses.io/{status}",
            Title: title,
            Status: status,
            Detail: null,
            TraceId: traceId,
            Errors: null);

        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/problem+json";
        return ctx.Response.WriteAsync(JsonSerializer.Serialize(body, JsonOpts));
    }
}