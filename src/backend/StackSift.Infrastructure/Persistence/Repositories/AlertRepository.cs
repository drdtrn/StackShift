using Microsoft.EntityFrameworkCore;
using StackSift.Domain.Entities;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Persistence.Repositories;

public class AlertRepository(AppDbContext context, ICurrentUserService currentUser)
    : EfCoreRepository<Alert>(context), IAlertRepository
{
    private readonly Guid _orgId = currentUser.OrganizationId;

    protected override IQueryable<Alert> BaseQuery =>
        Set.Where(a => a.OrganizationId == _orgId);

    public async Task<IList<Alert>> GetByProjectIdAsync(
        Guid projectId, int page, int pageSize, CancellationToken ct = default)
        => await BaseQuery
            .Where(a => a.ProjectId == projectId)
            .OrderByDescending(a => a.FiredAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

    public async Task<int> GetActiveCountByOrganizationIdAsync(Guid organizationId, CancellationToken ct = default)
        => await Set
            .Where(a => a.OrganizationId == organizationId && a.ResolvedAt == null && a.AcknowledgedAt == null)
            .CountAsync(ct);
}
