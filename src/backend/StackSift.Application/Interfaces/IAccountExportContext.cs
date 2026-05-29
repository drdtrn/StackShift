using StackSift.Domain.Entities;

namespace StackSift.Application.Interfaces;

/// <summary>
/// Narrow façade over the EF DbSet for AccountExportRequest. Lets the
/// handler stay in the Application layer without importing EF Core, while
/// avoiding a single-purpose repository for what is essentially a CRUD
/// table.
/// </summary>
public interface IAccountExportContext
{
    Task<AccountExportRequest?> GetByIdAsync(Guid id, CancellationToken ct);

    Task<AccountExportRequest?> GetPendingForUserAsync(Guid userId, CancellationToken ct);

    Task<AccountExportRequest?> GetMostRecentReadyForUserAsync(
        Guid userId,
        DateTimeOffset windowStart,
        CancellationToken ct);

    Task<IReadOnlyList<AccountExportRequest>> ListForUserAsync(
        Guid userId,
        int limit,
        CancellationToken ct);

    Task AddAsync(AccountExportRequest entity, CancellationToken ct);

    Task<int> SaveChangesAsync(CancellationToken ct);
}
