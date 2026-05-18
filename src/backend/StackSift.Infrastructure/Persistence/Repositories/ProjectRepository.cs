using Microsoft.EntityFrameworkCore;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Persistence.Repositories;

public class ProjectRepository(AppDbContext context, ICurrentUserService currentUser)
    : EfCoreRepository<Project>(context), IProjectRepository
{
    private readonly Guid _orgId = currentUser.OrganizationId;

    protected override IQueryable<Project> BaseQuery =>
        Set.Where(p => p.OrganizationId == _orgId);

    public async Task<IList<Project>> GetByOrganizationIdAsync(
        Guid orgId, int page, int pageSize, CancellationToken ct = default)
        => await Set
            .Where(p => p.OrganizationId == orgId)
            .OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

    public Task<bool> SlugExistsInOrgAsync(string slug, Guid organizationId, CancellationToken ct = default)
        => Set.AnyAsync(p => p.OrganizationId == organizationId && p.Slug == slug, ct);

    // Single SQL query with correlated subqueries — eliminates the N+1 pattern
    // that would occur if counts were fetched per-project in a loop.
    public async Task<IList<(Project project, int logSourceCount, int activeIncidentCount)>>
        GetWithCountsByOrganizationIdAsync(Guid orgId, int page, int pageSize, CancellationToken ct = default)
    {
        var rows = await Context.Set<Project>()
            .Where(p => p.OrganizationId == orgId)
            .OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(p => new
            {
                Project = p,
                LogSourceCount = Context.Set<LogSource>()
                    .Count(ls => ls.ProjectId == p.Id),
                ActiveIncidentCount = Context.Set<Incident>()
                    .Count(i => i.ProjectId == p.Id &&
                                (i.Status == IncidentStatus.Open || i.Status == IncidentStatus.Acknowledged))
            })
            .ToListAsync(ct);

        return rows.Select(r => (r.Project, r.LogSourceCount, r.ActiveIncidentCount)).ToList();
    }
}
