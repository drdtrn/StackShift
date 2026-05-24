using StackSift.Domain.Entities;

namespace StackSift.Domain.Interfaces.Repositories;

public interface IUserRepository : IRepository<User, Guid>
{
    Task<User?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<User?> FindByEmailAsync(string email, CancellationToken ct = default);
    Task<IList<User>> GetByOrganizationIdAsync(Guid organizationId, CancellationToken ct = default);
    // Returns users where Role IN (Owner, Admin) for the given org.
    Task<IReadOnlyList<User>> GetAdminsByOrgIdAsync(Guid organizationId, CancellationToken ct = default);
    Task<int> CountOwnersAsync(Guid organizationId, CancellationToken ct = default);
}
