using StackSift.Domain.Enums;

namespace StackSift.Domain.Interfaces;

public interface ICurrentUserService
{
    Guid UserId { get; }
    Guid OrganizationId { get; }
    string Email { get; }
    UserRole Role { get; }
    bool IsAuthenticated { get; }
}
