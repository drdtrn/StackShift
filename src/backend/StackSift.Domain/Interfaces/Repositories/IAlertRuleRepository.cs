using StackSift.Domain.Entities;

namespace StackSift.Domain.Interfaces.Repositories;

public interface IAlertRuleRepository : IRepository<AlertRule, Guid>
{
    Task<IList<AlertRule>> GetActiveByProjectIdAsync(Guid projectId, CancellationToken ct = default);
}
