using StackSift.Domain.Common;
using StackSift.Domain.Enums;

namespace StackSift.Domain.Entities;

public class LogSource : AuditableEntity<Guid>
{
    public Guid ProjectId { get; set; }
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public LogSourceType Type { get; set; }
    public string IngestUrl { get; set; } = "/api/v1/logs/ingest";
    public string KeyHash { get; set; } = string.Empty;
    public string KeyPrefix { get; set; } = string.Empty;
    public DateTimeOffset? KeyLastUsedAt { get; set; }
    public DateTimeOffset? KeyRotatedAt { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset? LastSeenAt { get; set; }
}
