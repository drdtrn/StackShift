using Microsoft.EntityFrameworkCore;
using StackSift.Domain.Entities;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Persistence.Repositories;

public class LogSourceRepository(AppDbContext context, ICurrentUserService currentUser)
    : EfCoreRepository<LogSource>(context), ILogSourceRepository
{
    protected override IQueryable<LogSource> BaseQuery =>
        Set.Where(ls => ls.OrganizationId == currentUser.OrganizationId);

    public async Task<IList<LogSource>> GetByProjectIdAsync(Guid projectId, CancellationToken ct = default)
        => await BaseQuery
            .Where(ls => ls.ProjectId == projectId)
            .OrderBy(ls => ls.Name)
            .ToListAsync(ct);

    public async Task<IList<LogSource>> GetByOrganizationAsync(CancellationToken ct = default)
        => await BaseQuery
            .OrderByDescending(ls => ls.KeyLastUsedAt ?? ls.CreatedAt)
            .ThenBy(ls => ls.Name)
            .ToListAsync(ct);

    public async Task<LogSource?> GetActiveByKeyPrefixAsync(string keyPrefix, CancellationToken ct = default)
        => await Set.FirstOrDefaultAsync(ls => ls.KeyPrefix == keyPrefix && ls.IsActive, ct);

    public async Task TouchKeyLastUsedAsync(Guid logSourceId, DateTimeOffset usedAt, CancellationToken ct = default)
        => await Set
            .Where(ls => ls.Id == logSourceId && ls.IsActive)
            .ExecuteUpdateAsync(s => s.SetProperty(ls => ls.KeyLastUsedAt, usedAt), ct);
}
