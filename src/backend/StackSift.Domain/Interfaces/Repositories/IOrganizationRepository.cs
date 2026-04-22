using StackSift.Domain.Entities;

namespace StackSift.Domain.Interfaces.Repositories;

public interface IOrganizationRepository : IRepository<Organization, Guid>
{
    Task<Organization?> GetBySlugAsync(string slug, CancellationToken ct = default);
    Task<Organization?> GetByIdWithProjectsAsync(Guid id, CancellationToken ct = default);
}
