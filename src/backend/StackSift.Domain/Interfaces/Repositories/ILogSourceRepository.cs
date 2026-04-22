using StackSift.Domain.Entities;

namespace StackSift.Domain.Interfaces.Repositories;

public interface ILogSourceRepository : IRepository<LogSource, Guid>
{
    Task<IList<LogSource>> GetByProjectIdAsync(Guid projectId, CancellationToken ct = default);
    Task<LogSource?> GetByApiKeyAsync(string apiKey, CancellationToken ct = default);
}
