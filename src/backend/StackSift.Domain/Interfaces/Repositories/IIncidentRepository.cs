using StackSift.Domain.Entities;
using StackSift.Domain.Enums;

namespace StackSift.Domain.Interfaces.Repositories;

public interface IIncidentRepository : IRepository<Incident, Guid>
{
    Task<IList<Incident>> GetByProjectIdAsync(Guid projectId, int page, int pageSize, IncidentStatus? status, CancellationToken ct = default);
    Task<IList<Incident>> GetByOrganizationIdAsync(int page, int pageSize, IncidentStatus? status, CancellationToken ct = default);
    Task<int> GetOpenCountByOrganizationIdAsync(Guid organizationId, CancellationToken ct = default);
}
