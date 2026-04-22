using StackSift.Domain.Common;
using StackSift.Domain.Enums;

namespace StackSift.Domain.Entities;

public class AlertRule : AuditableEntity<Guid>
{
    public Guid ProjectId { get; set; }
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public AlertRuleCondition Condition { get; set; }
    public decimal? Threshold { get; set; }
    public int WindowMinutes { get; set; }
    public LogLevel? LogLevel { get; set; }
    public string? Pattern { get; set; }
    public bool IsActive { get; set; } = true;
}
