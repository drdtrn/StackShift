using Microsoft.EntityFrameworkCore;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;

namespace StackSift.Infrastructure.Persistence;

public sealed class AccountErasureContext(AppDbContext db) : IAccountErasureContext
{
    public Task<AccountErasureRequest?> GetByIdAsync(Guid id, CancellationToken ct) =>
        db.AccountErasureRequests.FirstOrDefaultAsync(r => r.Id == id, ct);

    public Task<AccountErasureRequest?> GetActiveForUserAsync(Guid userId, CancellationToken ct) =>
        db.AccountErasureRequests
            .Where(r => r.UserId == userId
                && (r.Status == AccountErasureStatus.PendingGrace
                    || r.Status == AccountErasureStatus.AwaitingHumanReview))
            .FirstOrDefaultAsync(ct);

    public Task<AccountErasureRequest?> FindByCancellationHashAsync(string tokenHash, CancellationToken ct) =>
        db.AccountErasureRequests
            .Where(r => r.CancellationTokenHash == tokenHash
                && r.Status == AccountErasureStatus.PendingGrace)
            .FirstOrDefaultAsync(ct);

    public async Task<IReadOnlyList<AccountErasureRequest>> ListReadyForHardDeleteAsync(
        DateTimeOffset now, CancellationToken ct) =>
        await db.AccountErasureRequests
            .Where(r => r.Status == AccountErasureStatus.PendingGrace
                && r.GraceEndsAt <= now)
            .OrderBy(r => r.GraceEndsAt)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<AccountErasureRequest>> ListByStatusAsync(
        AccountErasureStatus status, int limit, CancellationToken ct) =>
        await db.AccountErasureRequests
            .Where(r => r.Status == status)
            .OrderBy(r => r.RequestedAt)
            .Take(limit)
            .ToListAsync(ct);

    public Task AddAsync(AccountErasureRequest entity, CancellationToken ct)
    {
        db.AccountErasureRequests.Add(entity);
        return Task.CompletedTask;
    }

    public Task<int> SaveChangesAsync(CancellationToken ct) => db.SaveChangesAsync(ct);
}
