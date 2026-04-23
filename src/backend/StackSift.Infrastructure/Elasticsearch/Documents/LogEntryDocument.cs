using StackSift.Domain.Enums;

namespace StackSift.Infrastructure.Elasticsearch.Documents;

/// <summary>
/// Flat Elasticsearch document — mirrors LogEntry without EF Core navigation overhead.
/// Index per organisation: stacksift-logs-{organizationId}
/// </summary>
public class LogEntryDocument
{
    public Guid Id { get; init; }
    public Guid ProjectId { get; init; }
    public Guid LogSourceId { get; init; }
    public Guid OrganizationId { get; init; }
    public string Level { get; init; } = string.Empty;
    public string Message { get; init; } = string.Empty;
    public DateTimeOffset Timestamp { get; init; }
    public string? TraceId { get; init; }
    public string? SpanId { get; init; }
    public string? ServiceName { get; init; }
    public string? HostName { get; init; }
    public Dictionary<string, object?> Metadata { get; init; } = [];

    public static LogEntryDocument FromDomain(StackSift.Domain.Entities.LogEntry e) => new()
    {
        Id = e.Id,
        ProjectId = e.ProjectId,
        LogSourceId = e.LogSourceId,
        OrganizationId = e.OrganizationId,
        Level = e.Level.ToString(),
        Message = e.Message,
        Timestamp = e.Timestamp,
        TraceId = e.TraceId,
        SpanId = e.SpanId,
        ServiceName = e.ServiceName,
        HostName = e.HostName,
        Metadata = e.Metadata,
    };

    public StackSift.Domain.Entities.LogEntry ToDomain() => new()
    {
        Id = Id,
        ProjectId = ProjectId,
        LogSourceId = LogSourceId,
        OrganizationId = OrganizationId,
        Level = Enum.Parse<LogLevel>(Level),
        Message = Message,
        Timestamp = Timestamp,
        TraceId = TraceId,
        SpanId = SpanId,
        ServiceName = ServiceName,
        HostName = HostName,
        Metadata = Metadata,
    };
}
