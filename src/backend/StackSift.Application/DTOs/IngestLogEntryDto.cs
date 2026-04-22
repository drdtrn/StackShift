using StackSift.Domain.Enums;

namespace StackSift.Application.DTOs;

public record IngestLogEntryDto(
    LogLevel Level,
    string Message,
    DateTimeOffset Timestamp,
    string? TraceId,
    string? SpanId,
    string? ServiceName,
    string? HostName,
    Dictionary<string, object?>? Metadata
);
