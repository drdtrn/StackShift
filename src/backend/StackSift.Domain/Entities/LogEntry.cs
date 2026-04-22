using StackSift.Domain.Common;
using StackSift.Domain.Enums;

namespace StackSift.Domain.Entities;

public class LogEntry : AuditableEntity<Guid>
{
    public Guid ProjectId { get; set; }
    public Guid LogSourceId { get; set; }
    public Guid OrganizationId { get; set; }
    public LogLevel Level { get; set; }
    public string Message { get; set; } = string.Empty;
    public DateTimeOffset Timestamp { get; set; }
    public string? TraceId { get; set; }
    public string? SpanId { get; set; }
    public string? ServiceName { get; set; }
    public string? HostName { get; set; }
    public Dictionary<string, object?> Metadata { get; set; } = [];
}
