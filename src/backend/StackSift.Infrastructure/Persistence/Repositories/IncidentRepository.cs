using Microsoft.EntityFrameworkCore;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Persistence.Repositories;

public class IncidentRepository(AppDbContext context, ICurrentUserService currentUser)
    : EfCoreRepository<Incident>(context), IIncidentRepository
{
    private readonly Guid _orgId = currentUser.OrganizationId;

    protected override IQueryable<Incident> BaseQuery =>
        Set.Where(i => i.OrganizationId == _orgId);

    public async Task<IList<Incident>> GetByProjectIdAsync(
        Guid projectId, int page, int pageSize, IncidentStatus? status, CancellationToken ct = default)
    {
        var query = BaseQuery.Where(i => i.ProjectId == projectId);

        if (status.HasValue)
            query = query.Where(i => i.Status == status.Value);

        return await query
            .OrderByDescending(i => i.StartedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
    }

    public async Task<IList<Incident>> GetByOrganizationIdAsync(
        int page, int pageSize, IncidentStatus? status, CancellationToken ct = default)
    {
        var query = BaseQuery;

        if (status.HasValue)
            query = query.Where(i => i.Status == status.Value);

        return await query
            .OrderByDescending(i => i.StartedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);
    }

    public async Task<int> GetOpenCountByOrganizationIdAsync(Guid organizationId, CancellationToken ct = default)
        => await Set
            .Where(i => i.OrganizationId == organizationId && i.Status == IncidentStatus.Open)
            .CountAsync(ct);
}
