using StackSift.Domain.Common;
using StackSift.Domain.Enums;

namespace StackSift.Domain.Entities;

public class Incident : AuditableEntity<Guid>
{
    public Guid ProjectId { get; set; }
    public Guid OrganizationId { get; set; }
    public IncidentStatus Status { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public AlertSeverity Severity { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? AcknowledgedAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public DateTimeOffset? ClosedAt { get; set; }
    public Guid? AssigneeId { get; set; }
    public Guid? AiAnalysisId { get; set; }
}
