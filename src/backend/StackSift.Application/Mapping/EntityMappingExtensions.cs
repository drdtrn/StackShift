using StackSift.Application.DTOs;

namespace StackSift.Application.Mapping;

public static class EntityMappingExtensions
{
    internal static ProjectDto ToDto(this Project p, int logSourceCount = 0, int activeIncidentCount = 0) =>
        new(p.Id, p.OrganizationId, p.Name, p.Slug, p.Description, p.Color,
            p.CreatedAt, p.UpdatedAt, logSourceCount, activeIncidentCount);

    internal static LogSourceDto ToDto(this LogSource ls) =>
        new(ls.Id, ls.ProjectId, ls.OrganizationId, ls.Name, ls.Type,
            ls.IngestUrl, ls.KeyPrefix, ls.KeyLastUsedAt, ls.KeyRotatedAt,
            ls.IsActive, ls.LastSeenAt, ls.CreatedAt);

    public static LogEntryDto ToDto(this LogEntry le) =>
        new(le.Id, le.ProjectId, le.LogSourceId, le.OrganizationId, le.Level,
            le.Message, le.Timestamp, le.TraceId, le.SpanId, le.ServiceName,
            le.HostName, le.Metadata ?? []);

    internal static AlertRuleDto ToDto(this AlertRule ar) =>
        new(ar.Id, ar.ProjectId, ar.OrganizationId, ar.Name, ar.Condition,
            ar.Threshold, ar.WindowMinutes, ar.LogLevel, ar.Pattern, ar.IsActive,
            ar.Severity, ar.CreatedAt, ar.UpdatedAt);

    internal static AlertDto ToDto(this Alert a) =>
        new(a.Id, a.ProjectId, a.OrganizationId, a.AlertRuleId, a.Severity,
            a.Title, a.Description, a.FiredAt, a.AcknowledgedAt, a.ResolvedAt, a.IncidentId);

    internal static IncidentDto ToDto(this Incident i) =>
        new(i.Id, i.ProjectId, i.OrganizationId, i.Status, i.Title, i.Description,
            i.Severity, i.StartedAt, i.AcknowledgedAt, i.ResolvedAt, i.ClosedAt,
            i.AssigneeId, i.AiAnalysisId);

    public static AiAnalysisDto ToDto(this AiAnalysis a, Guid projectId) =>
        new(a.Id, a.IncidentId, projectId, a.OrganizationId, a.Status, a.Summary, a.RootCause,
            a.SuggestedFixes ?? [], a.RelevantLogIds ?? [], a.ConfidenceScore,
            a.CreatedAt, a.CompletedAt);

    public static MemberDto ToMemberDto(this User u, string? invitedByDisplayName = null) =>
        new(u.Id, u.Email, u.DisplayName, u.Role,
            u.InvitedByUserId, invitedByDisplayName, u.CreatedAt, u.LastLoginAt);

    public static InvitationDto ToDto(this Invitation i) =>
        new(i.Id, i.OrganizationId, i.Email, i.Role,
            i.InvitedByUserId, i.ExpiresAt, i.CreatedAt);

    public static OrganizationDto ToDto(this Organization o) =>
        new(o.Id, o.Name, o.Slug, o.LogoUrl, o.Plan, o.CreatedAt, o.UpdatedAt);
}
