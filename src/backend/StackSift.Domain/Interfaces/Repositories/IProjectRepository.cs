using StackSift.Domain.Entities;

namespace StackSift.Domain.Interfaces.Repositories;

public interface IProjectRepository : IRepository<Project, Guid>
{
    Task<IList<Project>> GetByOrganizationIdAsync(Guid orgId, int page, int pageSize, CancellationToken ct = default);

    // Returns projects with computed counts in a single SQL query (no N+1).
    Task<IList<(Project project, int logSourceCount, int activeIncidentCount)>> GetWithCountsByOrganizationIdAsync(
        Guid orgId, int page, int pageSize, CancellationToken ct = default);
}
