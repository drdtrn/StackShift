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

    public async Task<IReadOnlyList<User>> GetAdminByOrgIdAsync(Guid organizationId, CancellationToken ct = default)
        => await Set
            .Where(u => u.OrganizationId == organizationId
                    && (u.Role == Domain.Enums.UserRole.Owner
                    || u.Role == Domain.Enums.UserRole.Admin))
            .OrderBy(u => u.DisplayName)
            .ToListAsync(ct);
}