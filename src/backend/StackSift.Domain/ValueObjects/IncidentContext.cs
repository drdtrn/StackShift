namespace StackSift.Domain.ValueObjects;

public sealed record IncidentContext(
    Guid IncidentId,
    string Title,
    string? Description,
    DateTimeOffset StartedAt,
    string ConcatenatedLogs,
    IReadOnlyList<Guid> ContributingLogIds
);
