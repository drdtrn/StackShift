using StackSift.Domain.Entities;
using StackSift.Domain.ValueObjects;

namespace StackSift.Domain.Interfaces.Repositories;

public interface ILogEntryRepository : IRepository<LogEntry, Guid>
{
    Task<(IList<LogEntry> Items, string? NextCursor, bool HasMore)> SearchAsync(
        LogQueryFilters filters, int limit, string? cursor, CancellationToken ct = default);
    Task BulkIndexAsync(IList<LogEntry> entries, CancellationToken ct = default);
    Task<long> GetTotalTodayByOrganizationIdAsync(Guid organizationId, CancellationToken ct = default);
    Task DeleteOlderThanAsync(Guid organizationId, DateTimeOffset cutoff, CancellationToken ct = default);
}
