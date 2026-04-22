using StackSift.Domain.Enums;

namespace StackSift.Application.DTOs;

public record AlertDto(
    Guid Id,
    Guid ProjectId,
    Guid OrganizationId,
    Guid? AlertRuleId,
    AlertSeverity Severity,
    string Title,
    string Description,
    DateTimeOffset FiredAt,
    DateTimeOffset? AcknowledgedAt,
    DateTimeOffset? ResolvedAt,
    Guid? IncidentId
);
