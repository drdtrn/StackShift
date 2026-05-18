using Microsoft.EntityFrameworkCore;
using StackSift.Domain.Common;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Persistence.Repositories;

public abstract class EfCoreRepository<TEntity>(AppDbContext context)
    : IRepository<TEntity, Guid>
    where TEntity : AuditableEntity<Guid>
{
    protected readonly AppDbContext Context = context;
    protected DbSet<TEntity> Set => Context.Set<TEntity>();

    // Concrete repos override this to add org-scoping (e.g. .Where(e => e.OrganizationId == _orgId))
    protected virtual IQueryable<TEntity> BaseQuery => Set;

    public virtual async Task<TEntity?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await BaseQuery.FirstOrDefaultAsync(e => e.Id == id, ct);

    public virtual async Task<IList<TEntity>> ListAsync(CancellationToken ct = default)
        => await BaseQuery.ToListAsync(ct);

    public virtual async Task AddAsync(TEntity entity, CancellationToken ct = default)
        => await Set.AddAsync(entity, ct);

    public virtual Task UpdateAsync(TEntity entity, CancellationToken ct = default)
    {
        Set.Update(entity);
        return Task.CompletedTask;
    }

    public virtual async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await Set.FindAsync([id], ct);
        if (entity is not null)
            Set.Remove(entity); // EF Core soft-delete interceptor handles IsDeleted in AppDbContext
    }

    public virtual async Task<bool> ExistsAsync(Guid id, CancellationToken ct = default)
        => await BaseQuery.AnyAsync(e => e.Id == id, ct);
}
