using Microsoft.EntityFrameworkCore;
using StackSift.Domain.Entities;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Persistence.Repositories;

// Organizations are not org-scoped — a user may belong to one org and must be able to
// look up their own org without a circular dependency on OrganizationId filtering.
public class OrganizationRepository(AppDbContext context)
    : EfCoreRepository<Organization>(context), IOrganizationRepository
{
    public async Task<Organization?> GetBySlugAsync(string slug, CancellationToken ct = default)
        => await BaseQuery.FirstOrDefaultAsync(o => o.Slug == slug, ct);

    // Organization has no Projects navigation property; returns the org record only.
    // Callers that need the projects list should use IProjectRepository.GetByOrganizationIdAsync.
    public async Task<Organization?> GetByIdWithProjectsAsync(Guid id, CancellationToken ct = default)
        => await BaseQuery.FirstOrDefaultAsync(o => o.Id == id, ct);

    public async Task<IReadOnlyList<Organization>> GetAllAsync(CancellationToken ct = default)
        => await BaseQuery.AsNoTracking().ToListAsync(ct);

    public async Task<bool> SlugExistsAsync(string slug, CancellationToken ct = default)
        => await Set.AnyAsync(o => o.Slug == slug, ct);

    public async Task HardDeleteAsync(Guid id, CancellationToken ct = default)
    {
        // ExecuteDeleteAsync issues a raw DELETE that skips the AppDbContext
        // SaveChangesAsync interceptor (which would otherwise flip Deleted →
        // Modified and turn this into a soft-delete).
        await Set.IgnoreQueryFilters()
            .Where(o => o.Id == id)
            .ExecuteDeleteAsync(ct);
    }
}