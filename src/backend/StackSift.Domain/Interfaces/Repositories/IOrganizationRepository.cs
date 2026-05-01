using StackSift.Domain.Entities;

namespace StackSift.Domain.Interfaces.Repositories;

public interface IOrganizationRepository : IRepository<Organization, Guid>
{
    Task<Organization?> GetBySlugAsync(string slug, CancellationToken ct = default);
    Task<Organization?> GetByIdWithProjectsAsync(Guid id, CancellationToken ct = default);
    // LogRetentionJob iterates all orgs to derive Plan-based cutoffs.
    Task<IReadOnlyList<Organization>> GetAllAsync(CancellationToken ct = default);
}
