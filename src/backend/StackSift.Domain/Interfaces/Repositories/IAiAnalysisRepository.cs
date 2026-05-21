using StackSift.Domain.Entities;

namespace StackSift.Domain.Interfaces.Repositories;

public interface IAiAnalysisRepository : IRepository<AiAnalysis, Guid>
{
    Task<AiAnalysis?> GetByIncidentIdAsync(Guid incidentId, CancellationToken ct = default);
    Task<IList<AiAnalysis>> SearchSimilarAsync(
        float[] embedding,
        int topK,
        Guid? excludeId = null,
        CancellationToken ct = default);

    Task<int> GetCountByOrgSinceAsync(Guid organizationId, DateTimeOffset since, CancellationToken ct = default);
}
