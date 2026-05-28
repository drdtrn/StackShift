using StackSift.Domain.Enums;

namespace StackSift.Domain.ValueObjects;

public record LogQueryFilters(
    Guid? ProjectId,
    IReadOnlyList<LogLevel>? Levels,
    string? Search,
    DateTimeOffset? StartDate,
    DateTimeOffset? EndDate,
    Guid? LogSourceId
);
