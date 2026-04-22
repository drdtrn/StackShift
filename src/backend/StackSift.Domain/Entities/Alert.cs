using StackSift.Domain.Common;
using StackSift.Domain.Enums;

namespace StackSift.Domain.Entities;

public class Alert : AuditableEntity<Guid>
{
    public Guid ProjectId { get; set; }
    public Guid OrganizationId { get; set; }
    public Guid? AlertRuleId { get; set; }
    public AlertSeverity Severity { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public DateTimeOffset FiredAt { get; set; }
    public DateTimeOffset? AcknowledgedAt { get; set; }
    public DateTimeOffset? ResolvedAt { get; set; }
    public Guid? IncidentId { get; set; }
}
