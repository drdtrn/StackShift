using Microsoft.EntityFrameworkCore;
using StackSift.Domain.Entities;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Infrastructure.Persistence.Repositories;

public class InvitationRepository(AppDbContext context)
    : EfCoreRepository<Invitation>(context), IInvitationRepository
{
    public async Task<Invitation?> FindPendingByEmailAsync(string email, CancellationToken ct = default)
    {
        var normalized = email.Trim().ToLower();
        var now = DateTimeOffset.UtcNow;
        return await Set
            .Where(i => i.Email == normalized
                     && i.AcceptedAt == null
                     && i.ExpiresAt > now)
            .OrderByDescending(i => i.CreatedAt)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<Invitation?> FindByTokenAsync(string token, CancellationToken ct = default)
        => await Set.FirstOrDefaultAsync(i => i.Token == token, ct);

    public async Task<IReadOnlyList<Invitation>> ListPendingByOrgAsync(
        Guid organizationId, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        return await Set
            .Where(i => i.OrganizationId == organizationId
                     && i.AcceptedAt == null
                     && i.ExpiresAt > now)
            .OrderByDescending(i => i.CreatedAt)
            .ToListAsync(ct);
    }

    public async Task<int> CountPendingByOrgAsync(Guid organizationId, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        return await Set
            .CountAsync(i => i.OrganizationId == organizationId
                          && i.AcceptedAt == null
                          && i.ExpiresAt > now, ct);
    }
}
