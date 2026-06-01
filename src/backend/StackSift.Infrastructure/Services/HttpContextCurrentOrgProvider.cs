using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using StackSift.Domain.Interfaces;

namespace StackSift.Infrastructure.Services;

internal sealed class HttpContextCurrentOrgProvider(
    IHttpContextAccessor httpContextAccessor,
    ILogger<HttpContextCurrentOrgProvider> logger) : ICurrentOrgProvider
{
    private static readonly AsyncLocal<bool> SystemScopeFlag = new();

    private ClaimsPrincipal? User => httpContextAccessor.HttpContext?.User;

    public Guid OrgId =>
        Guid.TryParse(User?.FindFirstValue("organization_id"), out var g) ? g : Guid.Empty;

    public Guid UserId =>
        Guid.TryParse(User?.FindFirstValue("sub"), out var s) ? s
        : Guid.TryParse(User?.FindFirstValue(ClaimTypes.NameIdentifier), out var n) ? n
        : Guid.Empty;

    public bool HasOrg => OrgId != Guid.Empty;

    public bool TenantFilterEnabled => !SystemScopeFlag.Value && httpContextAccessor.HttpContext is not null;

    public bool IsSystemScope => SystemScopeFlag.Value;

    public IDisposable EnterSystemScope(string reason)
    {
        logger.LogWarning("Entering system scope. Reason={Reason}", reason);
        SystemScopeFlag.Value = true;
        return new SystemScopeReleaser();
    }

    private sealed class SystemScopeReleaser : IDisposable
    {
        public void Dispose() => SystemScopeFlag.Value = false;
    }
}
