using StackSift.Domain.Enums;

namespace StackSift.Application.DTOs;

public record AiAnalysisDto(
    Guid Id,
    Guid IncidentId,
    Guid OrganizationId,
    AiAnalysisStatus Status,
    string? Summary,
    string? RootCause,
    List<string> SuggestedFixes,
    List<Guid> RelevantLogIds,
    double? ConfidenceScore,
    DateTimeOffset CreatedAt,
    DateTimeOffset? CompletedAt
);
