using Microsoft.EntityFrameworkCore;
using StackSift.Domain.Entities;
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
}
