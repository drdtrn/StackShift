using StackSift.Domain.Enums;

namespace StackSift.Domain.Entities;

public class AuditLogEntry
{
    public Guid Id { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid? ActorUserId { get; set; }
    public string? ActorEmail { get; set; }
    public AuditEvent Event { get; set; }
    public Guid? ProjectId { get; set; }
    public Guid? LogSourceId { get; set; }
    public Guid? TargetId { get; set; }
    public string? TargetType { get; set; }
    public string? Details { get; set; }
    public DateTimeOffset OccurredAt { get; set; }
}
