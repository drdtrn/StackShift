using StackSift.Domain.Entities;

namespace StackSift.Domain.Interfaces.Repositories;

public interface IInvitationRepository : IRepository<Invitation, Guid>
{
    Task<Invitation?> FindPendingByEmailAsync(string email, CancellationToken ct = default);
    Task<Invitation?> FindByTokenAsync(string token, CancellationToken ct = default);
}
