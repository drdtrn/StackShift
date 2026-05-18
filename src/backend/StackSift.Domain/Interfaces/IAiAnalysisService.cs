using StackSift.Domain.ValueObjects;

namespace StackSift.Domain.Interfaces;

public interface IAiAnalysisService
{
    Task<AiAnalysisResult> AnalyzeAsync(
        IncidentContext current,
        IReadOnlyList<SimilarIncident> similar,
        CancellationToken ct);
}
