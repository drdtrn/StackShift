using StackSift.Domain.Enums;

namespace StackSift.Application.DTOs;

public record LogEntryDto(
    Guid Id,
    Guid ProjectId,
    Guid LogSourceId,
    Guid OrganizationId,
    LogLevel Level,
    string Message,
    DateTimeOffset Timestamp,
    string? TraceId,
    string? SpanId,
    string? ServiceName,
    string? HostName,
    Dictionary<string, object?> Metadata
);
