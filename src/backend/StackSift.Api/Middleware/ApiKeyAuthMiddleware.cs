using System.Security.Claims;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Api.Middleware;

public sealed class ApiKeyAuthMiddleware(RequestDelegate next)
{
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