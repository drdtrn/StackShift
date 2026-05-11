using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces;

namespace StackSift.Tests.Helpers;

/// <summary>
/// Configurable ICurrentUserService for unit tests that need an AppDbContext
/// but don't have an HTTP request context.
/// </summary>
public sealed class FakeCurrentUserService : ICurrentUserService
{
    public Guid UserId { get; set; } = Guid.Empty;
    public Guid OrganizationId { get; set; } = Guid.Empty;
    public string Email { get; set; } = "system";
    public UserRole Role { get; set; } = UserRole.Owner;
    public bool IsAuthenticated { get; set; } = false;
}
