using StackSift.Domain.Enums;

namespace StackSift.Application.DTOs;

public record AlertRuleDto(
    Guid Id,
    Guid ProjectId,
    Guid OrganizationId,
    string Name,
    AlertRuleCondition Condition,
    decimal? Threshold,
    int WindowMinutes,
    LogLevel? LogLevel,
    string? Pattern,
    bool IsActive,
    AlertSeverity Severity,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
);
