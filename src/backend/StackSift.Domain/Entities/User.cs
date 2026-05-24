using StackSift.Domain.Common;
using StackSift.Domain.Enums;

namespace StackSift.Domain.Entities;

public class User : AuditableEntity<Guid>
{
    public Guid? OrganizationId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public UserRole Role { get; set; }
    public DateTimeOffset? LastLoginAt { get; set; }
    public Guid? InvitedByUserId { get; set; }
}
