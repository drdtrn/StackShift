using Elastic.Clients.Elasticsearch;
using Elastic.Clients.Elasticsearch.Core.Bulk;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackSift.Application.Interfaces;
using StackSift.Application.Messages;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Elasticsearch.Documents;
using StackSift.Application.Mapping;
using StackSift.Infrastructure.Persistence;
using LogLevel = StackSift.Domain.Enums.LogLevel;

namespace StackSift.Infrastructure.Messaging.Consumers;

public sealed class LogBatchConsumer(
    AppDbContext db,
    ElasticsearchClient esClient,
    ICacheService cache,
    IPublishEndpoint publishEndpoint,
    IAlertHubService alertHub,
    ILogger<LogBatchConsumer> logger)
    : IConsumer<LogBatchMessage>
{
    public async Task Consume(ConsumeContext<LogBatchMessage> context)
    {
        var msg = context.Message;
        var ct = context.CancellationToken;

        logger.LogInformation(
            "Processing LogBatchMessage: {Count} entries for project {ProjectId}",
            msg.Entries.Count, msg.ProjectId);

        // 1. Map DTOs → LogEntry domain entities with stable IDs for idempotent upsert
        var entries = msg.Entries.Select(dto => new LogEntry
        {
            Id = Guid.NewGuid(),
            OrganizationId = msg.OrganizationId,
            ProjectId = msg.ProjectId,
            LogSourceId = msg.LogSourceId,
            Level = dto.Level,
            Message = dto.Message,
            Timestamp = dto.Timestamp,
            TraceId = dto.TraceId,
            SpanId = dto.SpanId,
            ServiceName = dto.ServiceName,
            HostName = dto.HostName,
            Metadata = dto.Metadata ?? [],
        }).ToList();

        // 2. Bulk-index to Elasticsearch (idempotent: ES Index op upserts by document ID)
        await BulkIndexToEsAsync(entries, msg.OrganizationId, ct);

        // 2b. Broadcast each indexed entry to the project's SignalR group.
        // Done after persistence so the UI never sees an entry we failed to store.
        foreach (var entry in entries)
            await alertHub.BroadcastLogEntryAsync(entry.ToDto(), ct);

        if (msg.IsSynthetic) return;

        // 3. Load active alert rules for this project (bypasses org-scoped repo — org comes from message)
        var rules = await db.AlertRules
            .Where(r => r.ProjectId == msg.ProjectId && r.IsActive)
            .ToListAsync(ct);

        if (rules.Count == 0) return;

        // 4. Evaluate each rule; create Alert + Incident for matches
        bool anyAlertCreated = false;

        foreach (var rule in rules)
        {
            if (!EvaluateRule(rule, entries, out var firstMatchMessage))
                continue;

            // 5. Create Alert
            var alert = new Alert
            {
                Id = Guid.NewGuid(),
                OrganizationId = msg.OrganizationId,
                ProjectId = msg.ProjectId,
                AlertRuleId = rule.Id,
                Severity = rule.Severity,
                Title = rule.Name,
                Description = firstMatchMessage ?? string.Empty,
                FiredAt = DateTimeOffset.UtcNow,
            };

            // 6. Find existing open/acknowledged incident at same or higher severity; else create one
            var existingIncident = await db.Incidents
                .Where(i => i.ProjectId == msg.ProjectId
                    && (i.Status == IncidentStatus.Open || i.Status == IncidentStatus.Acknowledged)
                    && i.Severity >= rule.Severity)
                .OrderByDescending(i => i.StartedAt)
                .FirstOrDefaultAsync(ct);

            Guid incidentId;
            if (existingIncident is null)
            {
                var incident = new Incident
                {
                    Id = Guid.NewGuid(),
                    OrganizationId = msg.OrganizationId,
                    ProjectId = msg.ProjectId,
                    Status = IncidentStatus.Open,
                    Title = $"Incident: {rule.Name}",
                    Description = firstMatchMessage,
                    Severity = rule.Severity,
                    StartedAt = DateTimeOffset.UtcNow,
                };
                db.Incidents.Add(incident);
                incidentId = incident.Id;
            }
            else
            {
                incidentId = existingIncident.Id;
            }

            alert.IncidentId = incidentId;
            db.Alerts.Add(alert);
            await db.SaveChangesAsync(ct);
            anyAlertCreated = true;

            // 7. Publish AlertFiredMessage for downstream (SignalR broadcast, etc.)
            await publishEndpoint.Publish(
                new AlertFiredMessage(msg.OrganizationId, msg.ProjectId, alert.Id, incidentId, rule.Severity),
                ct);

            logger.LogInformation(
                "Alert {AlertId} created for rule '{Rule}', linked to incident {IncidentId}",
                alert.Id, rule.Name, incidentId);
        }

        // 8. Invalidate dashboard cache so fresh stats are served
        if (anyAlertCreated)
            await cache.RemoveAsync($"dashboard:stats:{msg.OrganizationId}", ct);
    }

    // ── Rule evaluation ──────────────────────────────────────────────────────

    private static bool EvaluateRule(AlertRule rule, List<LogEntry> entries, out string? firstMatchMessage)
    {
        firstMatchMessage = null;

        return rule.Condition switch
        {
            AlertRuleCondition.Threshold => EvaluateThreshold(rule, entries, out firstMatchMessage),
            AlertRuleCondition.Pattern => EvaluatePattern(rule, entries, out firstMatchMessage),
            AlertRuleCondition.Anomaly or AlertRuleCondition.Absence => false, // deferred to future sprint
            _ => false
        };
    }

    private static bool EvaluateThreshold(AlertRule rule, List<LogEntry> entries, out string? firstMatchMessage)
    {
        firstMatchMessage = null;
        if (!rule.Threshold.HasValue) return false;

        var matching = entries
            .Where(e => rule.LogLevel is null || e.Level == rule.LogLevel)
            .ToList();

        if (matching.Count >= (int)rule.Threshold.Value)
        {
            firstMatchMessage = matching[0].Message;
            return true;
        }
        return false;
    }

    private static bool EvaluatePattern(AlertRule rule, List<LogEntry> entries, out string? firstMatchMessage)
    {
        firstMatchMessage = null;
        if (string.IsNullOrEmpty(rule.Pattern)) return false;

        var hit = entries.FirstOrDefault(e =>
            e.Message.Contains(rule.Pattern, StringComparison.OrdinalIgnoreCase));

        if (hit is not null)
        {
            firstMatchMessage = hit.Message;
            return true;
        }
        return false;
    }

    // ── Elasticsearch bulk index ─────────────────────────────────────────────

    private async Task BulkIndexToEsAsync(List<LogEntry> entries, Guid organizationId, CancellationToken ct)
    {
        if (entries.Count == 0) return;

        var index = $"stacksift-logs-{organizationId}";
        var docs = entries.Select(LogEntryDocument.FromDomain).ToList();

        // Use explicit doc IDs for idempotent upsert semantics
        var ops = docs
            .Select(doc => (IBulkOperation)new BulkIndexOperation<LogEntryDocument>(doc) { Id = doc.Id.ToString() })
            .ToList();

        var response = await esClient.BulkAsync(new BulkRequest(index) { Operations = ops }, ct);

        if (response.Errors)
        {
            logger.LogError("ES bulk index errors: {Info}", response.DebugInformation);
            throw new InvalidOperationException($"Elasticsearch bulk index failed: {response.DebugInformation}");
        }

        logger.LogDebug("Indexed {Count} log entries to {Index}", docs.Count, index);
    }
}
