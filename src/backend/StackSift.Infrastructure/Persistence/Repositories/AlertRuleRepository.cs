using Microsoft.EntityFrameworkCore;
using StackSift.Domain.Entities;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Persistence.Repositories;

public class AlertRuleRepository(AppDbContext context, ICurrentUserService currentUser)
    : EfCoreRepository<AlertRule>(context), IAlertRuleRepository
{
    private readonly Guid _orgId = currentUser.OrganizationId;

    protected override IQueryable<AlertRule> BaseQuery =>
        Set.Where(ar => ar.OrganizationId == _orgId);

    public async Task<IList<AlertRule>> GetActiveByProjectIdAsync(Guid projectId, CancellationToken ct = default)
        => await BaseQuery
            .Where(ar => ar.ProjectId == projectId && ar.IsActive)
            .OrderBy(ar => ar.Name)
            .ToListAsync(ct);
}
