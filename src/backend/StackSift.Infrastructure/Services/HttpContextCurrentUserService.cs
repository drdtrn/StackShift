using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces;

namespace StackSift.Infrastructure.Services;

internal sealed class HttpContextCurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    private ClaimsPrincipal? User => httpContextAccessor.HttpContext?.User;
    // Default JWT handler maps "sub" → ClaimTypes.NameIdentifier and "email" →
    // ClaimTypes.Email; fall back to the mapped names so both pre- and post-
    // mapping principals work.
    public Guid UserId =>
        Guid.TryParse(User?.FindFirstValue("sub"), out var s) ? s
        : Guid.TryParse(User?.FindFirstValue(ClaimTypes.NameIdentifier), out var n) ? n
        : Guid.Empty;
    public Guid OrganizationId => Guid.TryParse(User?.FindFirstValue("organization_id"), out var id) ? id : Guid.Empty;
    public string Email =>
        User?.FindFirstValue("email") ?? User?.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
    public UserRole Role => Enum.TryParse<UserRole>(User?.FindFirstValue("stacksift_role"), ignoreCase: true, out var r) ? r : UserRole.Viewer;
    public bool IsAuthenticated => User?.Identity?.IsAuthenticated ?? false;
}