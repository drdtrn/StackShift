using System.Text.Json;
using FluentValidation;
using StackSift.Domain.Exceptions;

namespace StackSift.Api.Middleware;

/// <summary>Global exception handler. Maps domain exceptions
/// (<see cref="NotFoundException"/>, <see cref="ValidationException"/>,
/// <see cref="ForbiddenException"/>, <see cref="ConflictException"/>) to <c>ApiErrorResponse</c>
/// payloads with the correct HTTP status code, and falls back to 500 for unhandled errors.</summary>
public sealed class ExceptionHandlingMiddleware(
    RequestDelegate next,
    ILogger<ExceptionHandlingMiddleware> logger,
    IWebHostEnvironment env)
{
    /// <summary>ASP.NET Core middleware entry point.</summary>
    public async Task InvokeAsync(HttpContext ctx)
    {
        try
        {
            await next(ctx);
        }
        catch (Exception ex)
        {
            await HandleAsync(ctx, ex);
        }
    }

    private async Task HandleAsync(HttpContext ctx, Exception ex)
    {
        var traceId = ctx.Items[CorrelationIdMiddleware.ItemKey] as string;
        var (status, title, detail, errors) = Map(ex);

        if (status == StatusCodes.Status500InternalServerError)
            logger.LogError(ex, "Unhandled exception (CorrelationId={CorrelationId})", traceId);

        var body = new ApiErrorResponse(
            Type: $"https://httpstatuses.io/{status}",
            Title: title,
            Status: status,
            Detail: detail,
            TraceId: traceId,
            Errors: errors);

        ctx.Response.StatusCode = status;
        ctx.Response.ContentType = "application/problem+json";
        await ctx.Response.WriteAsync(
            JsonSerializer.Serialize(body, JwtProblemDetailsHelper.JsonOpts));
    }

    private (int status, string title, string? detail, IReadOnlyDictionary<string, string[]>? errors) Map(Exception ex)
        => ex switch
        {
            NotFoundException nf => (StatusCodes.Status404NotFound, "Not Found", nf.Message, null),

            ValidationException ve => (StatusCodes.Status400BadRequest, "Validation Failed", null,
                (IReadOnlyDictionary<string, string[]>)ve.Errors
                .GroupBy(e => Camelize(e.PropertyName))
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray())),

            ForbiddenException fb => (StatusCodes.Status403Forbidden, "Forbidden", fb.Message, null),

            ConflictException cf => (StatusCodes.Status409Conflict, "Conflict", cf.Message, null),

            _ => (StatusCodes.Status500InternalServerError, "Internal Server Error",
                env.IsDevelopment() ? ex.Message : null, null),
        };

    private static string Camelize(string s) =>
        string.IsNullOrEmpty(s) ? s : char.ToLowerInvariant(s[0]) + s[1..];
}