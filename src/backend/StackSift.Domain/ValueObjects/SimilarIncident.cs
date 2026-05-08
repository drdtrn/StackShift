namespace StackSift.Domain.ValueObjects;

public sealed record SimilarIncident(
    Guid AnalysisId,
    Guid IncidentId,
    string? Title,
    string? Summary,
    string? RootCause,
    IReadOnlyList<string> SuggestedFixes
);
