using Microsoft.EntityFrameworkCore;
using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;

namespace StackSift.Infrastructure.Persistence;

internal sealed class AccountExportContext(AppDbContext db) : IAccountExportContext
{
    public Task<AccountExportRequest?> GetByIdAsync(Guid id, CancellationToken ct) =>
        db.AccountExportRequests.FirstOrDefaultAsync(r => r.Id == id, ct);

    public Task<AccountExportRequest?> GetPendingForUserAsync(Guid userId, CancellationToken ct) =>
        db.AccountExportRequests
            .Where(r => r.UserId == userId && r.Status == AccountExportStatus.Pending)
            .FirstOrDefaultAsync(ct);

    public Task<AccountExportRequest?> GetMostRecentReadyForUserAsync(
        Guid userId, DateTimeOffset windowStart, CancellationToken ct) =>
        db.AccountExportRequests
            .Where(r => r.UserId == userId
                && r.Status == AccountExportStatus.Ready
                && r.RequestedAt > windowStart)
            .OrderByDescending(r => r.RequestedAt)
            .FirstOrDefaultAsync(ct);

    public async Task<IReadOnlyList<AccountExportRequest>> ListForUserAsync(
        Guid userId, int limit, CancellationToken ct) =>
        await db.AccountExportRequests
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.RequestedAt)
            .Take(limit)
            .ToListAsync(ct);

    public Task AddAsync(AccountExportRequest entity, CancellationToken ct)
    {
        db.AccountExportRequests.Add(entity);
        return Task.CompletedTask;
    }

    public Task<int> SaveChangesAsync(CancellationToken ct) => db.SaveChangesAsync(ct);
}
