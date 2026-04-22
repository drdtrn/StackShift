using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces;

namespace StackSift.Infrastructure.Services;

//Replaced by HttpContextCurrentUserService in BE-05
internal sealed class SystemCurrentUserService : ICurrentUserService
{
    public Guid UserId => Guid.Empty;
    public Guid OrganizationId => Guid.Empty;
    public string Email => "System";
    public UserRole Role => UserRole.Owner;
    public bool IsAuthenticated => false;
}