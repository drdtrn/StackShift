using Hangfire;
using Microsoft.Extensions.Logging;
using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces.Repositories;

namespace StackSift.Infrastructure.Jobs;

public sealed class LogRetentionJob(
    IOrganizationRepository organizations,
    ILogEntryRepository logEntries,
    ILogger<LogRetentionJob> logger)
{
    [AutomaticRetry(Attempts = 3)]
    public async Task ExecuteAsync(CancellationToken ct)
    {
        var orgs = await organizations.GetAllAsync(ct);
        logger.LogInformation("LogRetentionJob: applying retention to {Count} orgs", orgs.Count);

        foreach (var org in orgs)
        {
            var days = org.Plan switch
            {
                Plan.Free => 7,
                Plan.Indie => 30,
                Plan.Team => 90,
                _ => 7,
            };
            var cutoff = DateTimeOffset.UtcNow.AddDays(-days);

            try
            {
                await logEntries.DeleteOlderThanAsync(org.Id, cutoff, ct);
                logger.LogInformation("LogRetentionJob: org {OrgId} retention {Days}d applied (cutoff {Cutoff:o})", org.Id, days, cutoff);
            }
            catch (Exception ex)
            {
                // Don't fail the whole batch — one org's ES error must not block retention for others.
                logger.LogError(ex, "LogRetentionJob: failed for org {OrgId}", org.Id);
            }
        }
    }
}