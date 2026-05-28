using StackSift.Domain.Entities;

namespace StackSift.Domain.Interfaces.Repositories;

public interface ILogSourceRepository : IRepository<LogSource, Guid>
{
    Task<IList<LogSource>> GetByProjectIdAsync(Guid projectId, CancellationToken ct = default);
    Task<IList<LogSource>> GetByOrganizationAsync(CancellationToken ct = default);
    Task<LogSource?> GetActiveByKeyPrefixAsync(string keyPrefix, CancellationToken ct = default);
    Task TouchKeyLastUsedAsync(Guid logSourceId, DateTimeOffset usedAt, CancellationToken ct = default);
}
