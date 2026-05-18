namespace StackSift.Domain.ValueObjects;

public sealed record AiAnalysisResult(
    string Summary,
    string RootCause,
    IReadOnlyList<string> SuggestedFixes,
    double ConfidenceScore
);
