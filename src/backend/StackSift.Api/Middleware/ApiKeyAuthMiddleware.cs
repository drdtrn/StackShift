using System.Security.Claims;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Api.Middleware;

/// <summary>Authenticates log-ingestion callers via the <c>X-API-Key</c> header when no JWT
/// is present. Resolves the key against <see cref="ILogSourceRepository"/> and synthesises a
/// scoped <see cref="ClaimsPrincipal"/> for the matching log source.</summary>
public sealed class ApiKeyAuthMiddleware(RequestDelegate next)
{
    /// <summary>ASP.NET Core middleware entry point.</summary>
    public async Task InvokeAsync(HttpContext context, ILogSourceRepository logSourceRepository)
    {
        if (context.User.Identity?.IsAuthenticated != true &&
            context.Request.Headers.TryGetValue("X-API-Key", out var key))
        {
            var logSource = await logSourceRepository.GetByApiKeyAsync(key.ToString());

            if (logSource is { IsActive: true })
            {
                var claims = new[]
                {
                    new Claim("sub", logSource.Id.ToString()),
                    new Claim("organization_id", logSource.OrganizationId.ToString()),
                    new Claim("email", $"api-key@{logSource.Name}"),
                    new Claim("stacksift_role", "member")
                };
                context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "ApiKey"));
            } 
        }
        await next(context);
    }
}