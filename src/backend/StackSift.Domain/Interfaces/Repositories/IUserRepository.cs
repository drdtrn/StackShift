using StackSift.Domain.Entities;

namespace StackSift.Domain.Interfaces.Repositories;

public interface IUserRepository : IRepository<User, Guid>
{
    Task<User?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<IList<User>> GetByOrganizationIdAsync(Guid organizationId, CancellationToken ct = default);
}
