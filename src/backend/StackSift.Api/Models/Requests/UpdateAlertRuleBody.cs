using StackSift.Domain.Enums;
using LogLevel = StackSift.Domain.Enums.LogLevel;

namespace StackSift.Api.Models.Requests;

public record UpdateAlertRuleBody(
    string Name,
    AlertRuleCondition Condition,
    decimal? Threshold,
    int WindowMinutes,
    LogLevel? LogLevel,
    string? Pattern,
    bool IsActive);