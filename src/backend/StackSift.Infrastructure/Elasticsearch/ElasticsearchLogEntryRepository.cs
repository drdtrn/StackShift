using System.Text;
using Elastic.Clients.Elasticsearch;
using Elastic.Clients.Elasticsearch.QueryDsl;
using StackSift.Domain.Entities;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Domain.ValueObjects;
using StackSift.Infrastructure.Elasticsearch.Documents;

namespace StackSift.Infrastructure.Elasticsearch;

public class ElasticsearchLogEntryRepository(
    ElasticsearchClient client,
    ICurrentUserService currentUser) : ILogEntryRepository
{
    private string IndexForOrg(Guid orgId) => $"stacksift-logs-{orgId}";
    private string CurrentIndex => IndexForOrg(currentUser.OrganizationId);

    // ────────────────────────────────────────────────
    // IRepository<LogEntry, Guid> base methods
    // ────────────────────────────────────────────────

    public async Task<LogEntry?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var response = await client.GetAsync<LogEntryDocument>(
            new GetRequest(CurrentIndex, id), ct);

        if (!response.IsValidResponse) return null;
        return response.Found ? response.Source?.ToDomain() : null;
    }

    public Task<IList<LogEntry>> ListAsync(CancellationToken ct = default)
        => throw new NotSupportedException(
            "Use SearchAsync for log queries — ListAsync is not supported on the ES store.");

    public async Task AddAsync(LogEntry entity, CancellationToken ct = default)
    {
        var doc = LogEntryDocument.FromDomain(entity);
        var response = await client.IndexAsync(
            new IndexRequest<LogEntryDocument>(doc, CurrentIndex) { Id = doc.Id }, ct);

        if (!response.IsValidResponse)
            throw new InvalidOperationException($"ES index failed: {response.DebugInformation}");
    }

    public Task UpdateAsync(LogEntry entity, CancellationToken ct = default)
        => throw new NotSupportedException("Log entries are immutable — UpdateAsync is not supported.");

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var response = await client.DeleteAsync(new DeleteRequest(CurrentIndex, id), ct);
        if (!response.IsValidResponse)
            throw new InvalidOperationException($"ES delete failed: {response.DebugInformation}");
    }

    public async Task<bool> ExistsAsync(Guid id, CancellationToken ct = default)
    {
        var response = await client.ExistsAsync(new ExistsRequest(CurrentIndex, id), ct);
        return response.Exists;
    }

    // ────────────────────────────────────────────────
    // ILogEntryRepository specific methods
    // ────────────────────────────────────────────────

    public async Task<(IList<LogEntry> Items, string? NextCursor, bool HasMore)> SearchAsync(
        LogQueryFilters filters, int limit, string? cursor, CancellationToken ct = default)
    {
        // Decode base64 cursor → "{epochMs}|{id}"; id is the secondary tie-breaker
        FieldValue[]? searchAfter = null;
        if (cursor is not null)
        {
            var decoded = Encoding.UTF8.GetString(Convert.FromBase64String(cursor));
            var parts = decoded.Split('|');
            if (parts.Length >= 1 && long.TryParse(parts[0], out var epochMs))
            {
                var tieBreaker = parts.Length >= 2 ? parts[1] : string.Empty;
                searchAfter = [FieldValue.Long(epochMs), FieldValue.String(tieBreaker)];
            }
        }

        var mustClauses = BuildMustClauses(filters);

        var request = new SearchRequest(CurrentIndex)
        {
            Size = limit + 1, // fetch one extra to determine HasMore
            Sort =
            [
                new SortOptions
                {
                    Field = new FieldSort
                    {
                        Field = new Field("timestamp"),
                        Order = SortOrder.Desc,
                    }
                },
                new SortOptions
                {
                    Field = new FieldSort
                    {
                        Field = new Field("id.keyword"),
                        Order = SortOrder.Desc,
                    }
                },
            ],
            Query = mustClauses.Count > 0
                ? new Query { Bool = new BoolQuery { Must = mustClauses } }
                : new Query { MatchAll = new MatchAllQuery() },
            SearchAfter = searchAfter,
        };

        var response = await client.SearchAsync<LogEntryDocument>(request, ct);
        if (!response.IsValidResponse)
        {
            if (IsIndexNotFound(response)) return ([], null, false);
            throw new InvalidOperationException($"ES search failed: {response.DebugInformation}");
        }

        var hits = response.Hits.ToList();
        var hasMore = hits.Count > limit;
        if (hasMore) hits.RemoveAt(hits.Count - 1);

        var items = hits.Select(h => h.Source!.ToDomain()).ToList();

        string? nextCursor = null;
        if (hasMore && hits.Count > 0)
        {
            var last = hits[^1];
            var lastTs = last.Source!.Timestamp.ToUnixTimeMilliseconds();
            var lastId = last.Source.Id;
            nextCursor = Convert.ToBase64String(
                Encoding.UTF8.GetBytes($"{lastTs}|{lastId}"));
        }

        return (items, nextCursor, hasMore);
    }

    public async Task BulkIndexAsync(IList<LogEntry> entries, CancellationToken ct = default)
    {
        if (entries.Count == 0) return;

        var docs = entries.Select(LogEntryDocument.FromDomain);
        var response = await client.IndexManyAsync(docs, CurrentIndex, ct);

        if (response.Errors)
            throw new InvalidOperationException(
                $"ES bulk index had errors: {response.DebugInformation}");
    }

    public async Task<long> GetTotalTodayByOrganizationIdAsync(
        Guid organizationId, CancellationToken ct = default)
    {
        var startOfDay = new DateTimeOffset(DateTimeOffset.UtcNow.Date, TimeSpan.Zero);

        var response = await client.CountAsync(new CountRequest(IndexForOrg(organizationId))
        {
            Query = new Query
            {
                Range = new DateRangeQuery
                {
                    Field = new Field("timestamp"),
                    Gte = startOfDay.ToString("o")
                }
            }
        }, ct);

        if (!response.IsValidResponse)
        {
            if (IsIndexNotFound(response)) return 0;
            throw new InvalidOperationException($"ES count failed: {response.DebugInformation}");
        }

        return response.Count;
    }

    public async Task DeleteOlderThanAsync(
        Guid organizationId, DateTimeOffset cutoff, CancellationToken ct = default)
    {
        var response = await client.DeleteByQueryAsync(
            new DeleteByQueryRequest(IndexForOrg(organizationId))
            {
                Query = new Query
                {
                    Range = new DateRangeQuery
                    {
                        Field = new Field("timestamp"),
                        Lt = cutoff.ToString("o")
                    }
                }
            }, ct);

        if (!response.IsValidResponse)
        {
            if (IsIndexNotFound(response)) return;
            throw new InvalidOperationException(
                $"ES delete_by_query failed: {response.DebugInformation}");
        }
    }

    private static bool IsIndexNotFound(Elastic.Transport.Products.Elasticsearch.ElasticsearchResponse response) =>
        response.ElasticsearchServerError?.Error?.Type == "index_not_found_exception";

    // ────────────────────────────────────────────────
    // Helpers
    // ────────────────────────────────────────────────

    private static ICollection<Query> BuildMustClauses(LogQueryFilters filters)
    {
        var must = new List<Query>();

        if (filters.ProjectId.HasValue)
            must.Add(new Query
            {
                Term = new TermQuery
                {
                    Field = new Field("projectId"),
                    Value = FieldValue.String(filters.ProjectId.Value.ToString())
                }
            });

        if (filters.LogSourceId.HasValue)
            must.Add(new Query
            {
                Term = new TermQuery
                {
                    Field = new Field("logSourceId"),
                    Value = FieldValue.String(filters.LogSourceId.Value.ToString())
                }
            });

        if (filters.Levels is { Count: > 0 })
        {
            if (filters.Levels.Count == 1)
            {
                must.Add(new Query
                {
                    Term = new TermQuery
                    {
                        Field = new Field("level"),
                        Value = FieldValue.String(filters.Levels[0].ToString())
                    }
                });
            }
            else
            {
                must.Add(new Query
                {
                    Terms = new TermsQuery
                    {
                        Field = new Field("level"),
                        Terms = new TermsQueryField(filters.Levels
                            .Select(l => FieldValue.String(l.ToString()))
                            .ToArray())
                    }
                });
            }
        }

        if (!string.IsNullOrWhiteSpace(filters.Search))
            must.Add(new Query
            {
                Match = new MatchQuery
                {
                    Field = new Field("message"),
                    Query = filters.Search
                }
            });

        if (filters.StartDate.HasValue || filters.EndDate.HasValue)
        {
            var dateRange = new DateRangeQuery { Field = new Field("timestamp") };
            if (filters.StartDate.HasValue) dateRange.Gte = filters.StartDate.Value.ToString("o");
            if (filters.EndDate.HasValue) dateRange.Lte = filters.EndDate.Value.ToString("o");

            must.Add(new Query { Range = dateRange });
        }

        return must;
    }
}
