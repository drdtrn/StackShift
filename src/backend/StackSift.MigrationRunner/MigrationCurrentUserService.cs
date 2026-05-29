using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces;

namespace StackSift.MigrationRunner;

internal sealed class MigrationCurrentUserService : ICurrentUserService
{
    public Guid UserId => Guid.Empty;
    public Guid OrganizationId => Guid.Empty;
    public string Email => "migration-runner";
    public UserRole Role => UserRole.Owner;
    public bool IsAuthenticated => false;
}
