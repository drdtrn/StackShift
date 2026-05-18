using StackSift.Domain.Enums;
using LogLevel = StackSift.Domain.Enums.LogLevel;

namespace StackSift.Api.Models.Requests;

/// <summary>Body for <c>PUT /api/v1/alert-rules/{id}</c>.</summary>
/// <param name="Name">Alert rule display name.</param>
/// <param name="Condition">Match condition. See <see cref="AlertRuleCondition"/> for allowed values.</param>
/// <param name="Threshold">Numeric threshold value when <paramref name="Condition"/> is threshold-based; otherwise null.</param>
/// <param name="WindowMinutes">Rolling time window in minutes against which the condition is evaluated.</param>
/// <param name="LogLevel">Optional log-level filter (only matches logs at or above this level).</param>
/// <param name="Pattern">Regex pattern when <paramref name="Condition"/> is pattern-based; otherwise null.</param>
/// <param name="IsActive">Whether the rule is enabled. Inactive rules are not evaluated.</param>
public record UpdateAlertRuleBody(
    string Name,
    AlertRuleCondition Condition,
    decimal? Threshold,
    int WindowMinutes,
    LogLevel? LogLevel,
    string? Pattern,
    bool IsActive);
