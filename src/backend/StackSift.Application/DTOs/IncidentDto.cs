using StackSift.Domain.Enums;

namespace StackSift.Application.DTOs;

public record IncidentDto(
    Guid Id,
    Guid ProjectId,
    Guid OrganizationId,
    IncidentStatus Status,
    string Title,
    string? Description,
    AlertSeverity Severity,
    DateTimeOffset StartedAt,
    DateTimeOffset? AcknowledgedAt,
    DateTimeOffset? ResolvedAt,
    DateTimeOffset? ClosedAt,
    Guid? AssigneeId,
    Guid? AiAnalysisId
);
