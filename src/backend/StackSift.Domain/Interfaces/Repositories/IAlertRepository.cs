using StackSift.Domain.Entities;

namespace StackSift.Domain.Interfaces.Repositories;

public interface IAlertRepository : IRepository<Alert, Guid>
{
    Task<IList<Alert>> GetByProjectIdAsync(Guid projectId, int page, int pageSize, CancellationToken ct = default);
    Task<IList<Alert>> GetByIncidentIdAsync(Guid incidentId, int page, int pageSize, CancellationToken ct = default);
    Task<IList<Alert>> GetByOrganizationIdAsync(Guid organizationId, int page, int pageSize, CancellationToken ct = default);
    Task<int> GetActiveCountByOrganizationIdAsync(Guid organizationId, CancellationToken ct = default);
}
