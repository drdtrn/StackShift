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

    public async Task<IList<AiAnalysis>> SearchSimilarAsync(
        float[] embedding,
        int topK,
        Guid? excludeId = null,
        CancellationToken ct = default)
    {
        var vectorLiteral = string.Join(",",
            embedding.Select(f => f.ToString("G9", CultureInfo.InvariantCulture)));

        var sql = $$"""
            SELECT * FROM "AiAnalyses"
            WHERE "IsDeleted" = FALSE
              AND "OrganizationId" = {0}
              AND "Embedding" IS NOT NULL
              AND "Status" = 'Completed'
              AND ({2} = '00000000-0000-0000-0000-000000000000'::uuid OR "Id" <> {2})
            ORDER BY "Embedding" <=> '[{{vectorLiteral}}]'::vector
            LIMIT {1}
            """;

        return await Context.AiAnalyses
            .FromSqlRaw(sql, _orgId, topK, excludeId ?? Guid.Empty)
            .AsNoTracking()
            .ToListAsync(ct);
    }
}
