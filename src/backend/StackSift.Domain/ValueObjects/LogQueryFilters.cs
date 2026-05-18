using StackSift.Domain.Enums;

namespace StackSift.Domain.ValueObjects;

public record LogQueryFilters(
    Guid? ProjectId,
    LogLevel? Level,
    string? Search,
    DateTimeOffset? StartDate,
    DateTimeOffset? EndDate,
    Guid? LogSourceId
);
