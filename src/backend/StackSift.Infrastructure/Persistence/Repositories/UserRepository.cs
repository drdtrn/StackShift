using Microsoft.EntityFrameworkCore;
using StackSift.Domain.Entities;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Persistence.Repositories;

public class UserRepository(AppDbContext context)
    : EfCoreRepository<User>(context), IUserRepository
{
    public async Task<User?> GetByEmailAsync(string email, CancellationToken ct = default)
        // Email lookup is cross-org (needed during authentication / onboarding).
        => await Set.FirstOrDefaultAsync(u => u.Email == email, ct);

    public async Task<IList<User>> GetByOrganizationIdAsync(Guid organizationId, CancellationToken ct = default)
        => await Set
            .Where(u => u.OrganizationId == organizationId)
            .OrderBy(u => u.DisplayName)
            .ToListAsync(ct);
}
