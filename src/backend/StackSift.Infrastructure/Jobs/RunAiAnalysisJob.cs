using System.Globalization;
using System.Text;
using Elastic.Clients.Elasticsearch;
using Elastic.Clients.Elasticsearch.QueryDsl;
using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackSift.Application.Interfaces;
using StackSift.Application.Mapping;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Exceptions;
using StackSift.Domain.Interfaces;
using StackSift.Domain.ValueObjects;
using StackSift.Infrastructure.Configuration;
using StackSift.Infrastructure.Elasticsearch.Documents;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Jobs;

public sealed class RunAiAnalysisJob(
    AppDbContext db,
    ElasticsearchClient esClient,
    IVectorSearchService vectorSearch,
    IAiAnalysisService aiService,
    IAlertHubService alertHub,
    IOptions<OpenAiOptions> openAiOptions,
    ILogger<RunAiAnalysisJob> logger)
{
    private const double DedupeCosineDistance = 0.05;
    private const int LogContextLimit = 50;

    [AutomaticRetry(Attempts = 5, DelaysInSeconds = new[] { 30, 120, 300, 600, 1800 })]
    public async Task ExecuteAsync(Guid analysisId, CancellationToken ct)
    {
        var analysis = await db.AiAnalyses.FirstOrDefaultAsync(a => a.Id == analysisId, ct);
        if (analysis is null)
        {
            logger.LogWarning("RunAiAnalysisJob: AiAnalysis {Id} not found — skipping", analysisId);
            return;
        }

        if (analysis.Status == AiAnalysisStatus.Completed)
        {
            logger.LogInformation("RunAiAnalysisJob: {Id} already Completed — no-op", analysisId);
            return;
        }

        if (string.IsNullOrWhiteSpace(openAiOptions.Value.ApiKey))
        {
            await MarkFailedAsync(analysis, "OpenAI API key not configured", ct);
            return;
        }

        analysis.Status = AiAnalysisStatus.Processing;
        await db.SaveChangesAsync(ct);

        try
        {
            var incident = await db.Incidents.FirstOrDefaultAsync(
                i => i.Id == analysis.IncidentId, ct)
                ?? throw new AiAnalysisException(
                    $"Parent incident {analysis.IncidentId} not found.");

            var logs = await SearchLogsAsync(incident, ct);

            var concatenated = string.Join(Environment.NewLine,
                logs.Select(l => $"[{l.Timestamp:O}] [{l.Level}] {l.Message}"));
            var contributingIds = logs.Select(l => l.Id).ToList();

            float[]? embedding = null;
            if (!string.IsNullOrWhiteSpace(concatenated))
            {
                embedding = await vectorSearch.EmbedAsync(concatenated, ct);
                analysis.Embedding = embedding;
            }
            else
            {
                logger.LogInformation(
                    "RunAiAnalysisJob: {Id} — no logs found in ES window, proceeding without embedding",
                    analysisId);
            }

            analysis.RelevantLogIds = contributingIds;
            await db.SaveChangesAsync(ct);

            IReadOnlyList<SimilarIncident> similar = [];
            if (embedding is not null)
            {
                if (await TryDedupeAsync(analysis, embedding, incident.OrganizationId, ct))
                    return;

                var similarIds = await FindSimilarAnalysisIdsAsync(embedding, 3, analysis.Id, incident.OrganizationId, ct);
                var similarRows = await db.AiAnalyses
                    .Where(a => similarIds.Contains(a.Id))
                    .ToListAsync(ct);
                similar = await BuildSimilarAsync(similarRows, ct);
            }

            var ctx = new IncidentContext(
                IncidentId: incident.Id,
                Title: incident.Title,
                Description: incident.Description,
                StartedAt: incident.StartedAt,
                ConcatenatedLogs: concatenated,
                ContributingLogIds: contributingIds);

            var result = await aiService.AnalyzeAsync(ctx, similar, ct);

            analysis.Summary = result.Summary;
            analysis.RootCause = result.RootCause;
            analysis.SuggestedFixes = result.SuggestedFixes.ToList();
            analysis.ConfidenceScore = result.ConfidenceScore;
            analysis.Status = AiAnalysisStatus.Completed;
            analysis.CompletedAt = DateTimeOffset.UtcNow;
            await db.SaveChangesAsync(ct);

            await alertHub.BroadcastAiAnalysisCompletedAsync(
                analysis.ToDto(incident.ProjectId), ct);

            logger.LogInformation(
                "RunAiAnalysisJob: {Id} completed — {Fixes} fixes, confidence {Confidence:P0}",
                analysisId, result.SuggestedFixes.Count, result.ConfidenceScore);
        }
        catch (AiAnalysisException ex)
        {
            logger.LogError(ex, "RunAiAnalysisJob: {Id} failed (logical) — Status=Failed", analysisId);
            await MarkFailedAsync(analysis, $"Analysis failed: {Sanitize(ex.Message)}", ct);
        }
        catch (Exception ex) when (!ct.IsCancellationRequested)
        {
            logger.LogWarning(ex, "RunAiAnalysisJob: {Id} transient error — Hangfire will retry", analysisId);
            throw;
        }
    }

    private async Task<List<LogEntryDocument>> SearchLogsAsync(Incident incident, CancellationToken ct)
    {
        var index = $"stacksift-logs-{incident.OrganizationId}";
        var window = TimeSpan.FromMinutes(5);
        var from = incident.StartedAt - window;
        var to = incident.StartedAt + window;

        var request = new SearchRequest(index)
        {
            Size = LogContextLimit,
            Sort =
            [
                new SortOptions
                {
                    Field = new FieldSort
                    {
                        Field = new Field("timestamp"),
                        Order = SortOrder.Desc
                    }
                }
            ],
            Query = new Query
            {
                Bool = new BoolQuery
                {
                    Must =
                    [
                        new Query
                        {
                            Term = new TermQuery
                            {
                                Field = new Field("projectId"),
                                Value = FieldValue.String(incident.ProjectId.ToString())
                            }
                        },
                        new Query
                        {
                            Range = new DateRangeQuery
                            {
                                Field = new Field("timestamp"),
                                Gte = from.ToString("o"),
                                Lte = to.ToString("o")
                            }
                        }
                    ]
                }
            }
        };

        try
        {
            var response = await esClient.SearchAsync<LogEntryDocument>(request, ct);
            if (!response.IsValidResponse)
            {
                logger.LogWarning(
                    "RunAiAnalysisJob: ES log search failed for incident {Id} — proceeding without log context: {Debug}",
                    incident.Id, response.DebugInformation);
                return [];
            }
            return response.Hits.Select(h => h.Source!).ToList();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "RunAiAnalysisJob: ES log search threw for incident {Id} — proceeding without log context",
                incident.Id);
            return [];
        }
    }

    private async Task<List<Guid>> FindSimilarAnalysisIdsAsync(
        float[] embedding, int topK, Guid excludeId, Guid organizationId, CancellationToken ct)
    {
        try
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

            var rows = await db.AiAnalyses
                .FromSqlRaw(sql, organizationId, topK, excludeId)
                .AsNoTracking()
                .ToListAsync(ct);

            return rows.Select(a => a.Id).ToList();
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex,
                "RunAiAnalysisJob: similarity search unavailable — proceeding without RAG context");
            return [];
        }
    }

    private async Task<bool> TryDedupeAsync(AiAnalysis analysis, float[] embedding, Guid organizationId, CancellationToken ct)
    {
        var candidates = await FindSimilarAnalysisIdsAsync(embedding, 1, analysis.Id, organizationId, ct);
        if (candidates.Count == 0) return false;

        logger.LogDebug(
            "RunAiAnalysisJob: dedupe candidate {Candidate} found but distance unavailable — proceeding with full RAG",
            candidates[0]);
        return false;
    }

    private async Task<IReadOnlyList<SimilarIncident>> BuildSimilarAsync(
        IList<AiAnalysis> rows, CancellationToken ct)
    {
        if (rows.Count == 0) return [];

        var incidentIds = rows.Select(r => r.IncidentId).Distinct().ToList();
        var incidents = await db.Incidents
            .Where(i => incidentIds.Contains(i.Id))
            .ToDictionaryAsync(i => i.Id, ct);

        return rows.Select(r => new SimilarIncident(
            AnalysisId: r.Id,
            IncidentId: r.IncidentId,
            Title: incidents.TryGetValue(r.IncidentId, out var inc) ? inc.Title : null,
            Summary: r.Summary,
            RootCause: r.RootCause,
            SuggestedFixes: r.SuggestedFixes ?? [])).ToList();
    }

    private async Task MarkFailedAsync(AiAnalysis a, string summary, CancellationToken ct)
    {
        a.Status = AiAnalysisStatus.Failed;
        a.Summary = summary;
        a.CompletedAt = DateTimeOffset.UtcNow;
        await db.SaveChangesAsync(ct);
    }

    private static string Sanitize(string message)
    {
        const string KeyPrefix = "sk-";
        var idx = message.IndexOf(KeyPrefix, StringComparison.Ordinal);
        if (idx < 0) return message;
        var sb = new StringBuilder(message);
        for (var i = idx; i < sb.Length && !char.IsWhiteSpace(sb[i]); i++)
            sb[i] = '*';
        return sb.ToString();
    }
}
