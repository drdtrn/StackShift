using StackSift.Domain.Entities;
using StackSift.Domain.Enums;

namespace StackSift.Application.Interfaces;

public interface IAccountErasureContext
{
    Task<AccountErasureRequest?> GetByIdAsync(Guid id, CancellationToken ct);

    Task<AccountErasureRequest?> GetActiveForUserAsync(Guid userId, CancellationToken ct);

    Task<AccountErasureRequest?> FindByCancellationHashAsync(string tokenHash, CancellationToken ct);

    Task<IReadOnlyList<AccountErasureRequest>> ListReadyForHardDeleteAsync(
        DateTimeOffset now,
        CancellationToken ct);

    Task<IReadOnlyList<AccountErasureRequest>> ListByStatusAsync(
        AccountErasureStatus status,
        int limit,
        CancellationToken ct);

    Task AddAsync(AccountErasureRequest entity, CancellationToken ct);

    Task<int> SaveChangesAsync(CancellationToken ct);
}
