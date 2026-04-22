using StackSift.Domain.Entities;

namespace StackSift.Domain.Interfaces.Repositories;

public interface IProjectRepository : IRepository<Project, Guid>
{
    Task<IList<Project>> GetByOrganizationIdAsync(Guid orgId, int page, int pageSize, CancellationToken ct = default);
}
