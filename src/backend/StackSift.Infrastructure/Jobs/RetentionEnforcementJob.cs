using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Jobs;

public sealed class RetentionEnforcementJob(
    AppDbContext db,
    ILogger<RetentionEnforcementJob> log)
{
    private const int AuditFloorDays = 365;
    private const int StripeFloorDays = 365;

    [AutomaticRetry(Attempts = 3)]
    public async Task ExecuteAsync(CancellationToken ct)
    {
        var orgs = await db.Organizations
            .AsNoTracking()
            .Select(o => new OrgPlanSnapshot(o.Id, o.Plan))
            .ToListAsync(ct);

        log.LogInformation(
            "RetentionEnforcementJob: sweeping {OrgCount} organizations + regulatory-floor tables.",
            orgs.Count);

        var totalAlerts = 0;
        var totalIncidents = 0;
        foreach (var org in orgs)
        {
            try
            {
                var alertCutoff = DateTimeOffset.UtcNow.AddDays(-AlertRetentionDays(org.Plan));
                var incidentCutoff = DateTimeOffset.UtcNow.AddDays(-IncidentRetentionDays(org.Plan));

                var deletedAlerts = await db.Alerts
                    .Where(a => a.OrganizationId == org.Id && a.CreatedAt < alertCutoff)
                    .ExecuteDeleteAsync(ct);
                totalAlerts += deletedAlerts;

                var deletedIncidents = await db.Incidents
                    .Where(i => i.OrganizationId == org.Id && i.CreatedAt < incidentCutoff)
                    .ExecuteDeleteAsync(ct);
                totalIncidents += deletedIncidents;

                log.LogInformation(
                    "RetentionEnforcementJob: org {OrgId} ({Plan}) — deleted {Alerts} alerts, {Incidents} incidents.",
                    org.Id, org.Plan, deletedAlerts, deletedIncidents);
            }
            catch (Exception ex)
            {
                log.LogError(ex,
                    "RetentionEnforcementJob: org {OrgId} sweep failed; continuing.",
                    org.Id);
            }
        }

        // Regulatory-floor tables apply uniformly across tiers.
        var auditCutoff = DateTimeOffset.UtcNow.AddDays(-AuditFloorDays);
        var stripeCutoff = DateTimeOffset.UtcNow.AddDays(-StripeFloorDays);

        var deletedAudit = await db.AuditLogEntries
            .Where(a => a.OccurredAt < auditCutoff)
            .ExecuteDeleteAsync(ct);

        var deletedStripe = await db.StripeWebhookEvents
            .Where(e => e.ReceivedAt < stripeCutoff)
            .ExecuteDeleteAsync(ct);

        log.LogInformation(
            "RetentionEnforcementJob: complete. " +
            "Across {OrgCount} orgs: alerts={Alerts}, incidents={Incidents}. " +
            "Regulatory floor: audit={Audit}, stripeWebhooks={Stripe}.",
            orgs.Count, totalAlerts, totalIncidents, deletedAudit, deletedStripe);
    }

    internal static int AlertRetentionDays(Plan plan) => plan switch
    {
        Plan.Free => 30,
        Plan.Indie => 180,
        Plan.Team => 365,
        _ => 30,
    };

    internal static int IncidentRetentionDays(Plan plan) => AlertRetentionDays(plan);

    private readonly record struct OrgPlanSnapshot(Guid Id, Plan Plan);
}
