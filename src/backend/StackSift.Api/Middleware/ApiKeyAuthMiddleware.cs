using System.Security.Claims;
using StackSift.Application.Interfaces;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Api.Middleware;

internal sealed class ApiKeyAuthMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(
        HttpContext context,
        ILogSourceRepository logSourceRepository,
        IApiKeyHasher apiKeyHasher,
        IServiceScopeFactory scopeFactory)
    {
        if (context.User.Identity?.IsAuthenticated != true &&
            context.Request.Headers.TryGetValue("X-API-Key", out var key))
        {
            var apiKey = key.ToString();
            var logSource = apiKey.Length >= 8
                ? await logSourceRepository.GetActiveByKeyPrefixAsync(apiKey[..8])
                : null;

            if (logSource is not null && apiKeyHasher.Verify(apiKey, logSource.KeyHash))
            {
                var claims = new[]
                {
                    new Claim("sub", logSource.Id.ToString()),
                    new Claim("organization_id", logSource.OrganizationId.ToString()),
                    new Claim("email", $"api-key@{logSource.Name}"),
                    new Claim("stacksift_role", "member")
                };
                context.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "ApiKey"));
                _ = TouchKeyLastUsedAsync(scopeFactory, logSource.Id);
            } 
        }
        await next(context);
    }

    private static async Task TouchKeyLastUsedAsync(IServiceScopeFactory scopeFactory, Guid logSourceId)
    {
        using var scope = scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<ILogSourceRepository>();
        await repository.TouchKeyLastUsedAsync(logSourceId, DateTimeOffset.UtcNow);
    }
}
