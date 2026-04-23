using System.Globalization;
using Microsoft.EntityFrameworkCore;
using StackSift.Domain.Entities;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Persistence.Repositories;

public class AiAnalysisRepository(AppDbContext context, ICurrentUserService currentUser)
    : EfCoreRepository<AiAnalysis>(context), IAiAnalysisRepository
{
    private readonly Guid _orgId = currentUser.OrganizationId;

    protected override IQueryable<AiAnalysis> BaseQuery =>
        Set.Where(a => a.OrganizationId == _orgId);

    public async Task<AiAnalysis?> GetByIncidentIdAsync(Guid incidentId, CancellationToken ct = default)
        => await BaseQuery.FirstOrDefaultAsync(a => a.IncidentId == incidentId, ct);

    // EF Core configuration ignores the Embedding column (see AiAnalysisConfiguration).
    // We use raw SQL with the pgvector cosine-distance operator (<=>) to perform vector search.
    public async Task<IList<AiAnalysis>> SearchSimilarAsync(
        float[] embedding, int topK, CancellationToken ct = default)
    {
        // Format floats with full precision and invariant culture to build a valid vector literal.
        var vectorLiteral = string.Join(",",
            embedding.Select(f => f.ToString("G9", CultureInfo.InvariantCulture)));

        // $$-prefixed raw string: {{expr}} = interpolation, {0}/{1} = literal FromSqlRaw params
        var sql = $$"""
            SELECT * FROM "AiAnalyses"
            WHERE "IsDeleted" = FALSE
              AND "OrganizationId" = {0}
              AND "Embedding" IS NOT NULL
            ORDER BY "Embedding" <=> '[{{vectorLiteral}}]'::vector
            LIMIT {1}
            """;

        return await Context.AiAnalyses
            .FromSqlRaw(sql, _orgId, topK)
            .AsNoTracking()
            .ToListAsync(ct);
    }
}
