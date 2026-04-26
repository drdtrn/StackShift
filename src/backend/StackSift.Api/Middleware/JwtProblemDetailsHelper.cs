using System.Text.Json;

namespace StackSift.Api.Middleware;

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