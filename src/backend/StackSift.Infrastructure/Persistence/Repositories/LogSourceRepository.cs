using Microsoft.EntityFrameworkCore;
using StackSift.Domain.Entities;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Persistence.Repositories;

public class LogSourceRepository(AppDbContext context, ICurrentUserService currentUser)
    : EfCoreRepository<LogSource>(context), ILogSourceRepository
{
    private readonly Guid _orgId = currentUser.OrganizationId;

    protected override IQueryable<LogSource> BaseQuery =>
        Set.Where(ls => ls.OrganizationId == _orgId);

    public async Task<IList<LogSource>> GetByProjectIdAsync(Guid projectId, CancellationToken ct = default)
        => await BaseQuery
            .Where(ls => ls.ProjectId == projectId)
            .OrderBy(ls => ls.Name)
            .ToListAsync(ct);

    public async Task<LogSource?> GetByApiKeyAsync(string apiKey, CancellationToken ct = default)
        // API key lookup must not be org-scoped — the key uniquely identifies the source.
        => await Set.FirstOrDefaultAsync(ls => ls.ApiKey == apiKey, ct);
}
