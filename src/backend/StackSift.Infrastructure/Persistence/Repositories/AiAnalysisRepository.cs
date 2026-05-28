using System.Globalization;
using Microsoft.EntityFrameworkCore;
using StackSift.Domain.Entities;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Domain.ValueObjects;
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
        var vectorLiteral = FormatVectorLiteral(embedding);

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

    public async Task<IReadOnlyList<AiAnalysisSimilarity>> SearchSimilarWithDistanceAsync(
        float[] embedding,
        int topK,
        Guid? excludeId = null,
        CancellationToken ct = default)
    {
        var vectorLiteral = FormatVectorLiteral(embedding);

        var sql = $$"""
            SELECT "Id" AS "AnalysisId", "Embedding" <=> '[{{vectorLiteral}}]'::vector AS "Distance"
            FROM "AiAnalyses"
            WHERE "IsDeleted" = FALSE
              AND "OrganizationId" = {0}
              AND "Embedding" IS NOT NULL
              AND "Status" = 'Completed'
              AND ({2} = '00000000-0000-0000-0000-000000000000'::uuid OR "Id" <> {2})
            ORDER BY "Embedding" <=> '[{{vectorLiteral}}]'::vector
            LIMIT {1}
            """;

        var rows = await Context.Database
            .SqlQueryRaw<AiAnalysisSimilarity>(sql, _orgId, topK, excludeId ?? Guid.Empty)
            .ToListAsync(ct);

        return rows;
    }

    public Task<int> GetCountByOrgSinceAsync(Guid organizationId, DateTimeOffset since, CancellationToken ct = default)
        => Set
            .Where(a => a.OrganizationId == organizationId && a.CreatedAt >= since)
            .CountAsync(ct);

    private static string FormatVectorLiteral(float[] embedding) =>
        string.Join(",", embedding.Select(f => f.ToString("G9", CultureInfo.InvariantCulture)));
}
