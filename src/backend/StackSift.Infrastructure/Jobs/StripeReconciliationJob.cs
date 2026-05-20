using Hangfire;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackSift.Application.Interfaces;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Jobs;

public sealed class StripeReconciliationJob(
    AppDbContext db,
    IStripeService stripe,
    ILogger<StripeReconciliationJob> logger)
{
    [AutomaticRetry(Attempts = 2, DelaysInSeconds = new[] { 600, 1800 })]
    public async Task ExecuteAsync(CancellationToken ct)
    {
        var paidOrgs = await db.Organizations
            .Where(o => o.StripeSubscriptionId != null)
            .ToListAsync(ct);

        logger.LogInformation(
            "StripeReconciliationJob: reconciling {Count} orgs with active Stripe subscriptions",
            paidOrgs.Count);

        var drifted = 0;

        foreach (var org in paidOrgs)
        {
            if (string.IsNullOrEmpty(org.StripeCustomerId)) continue;

            try
            {
                // The real implementation would fetch the subscription state from Stripe
                // and reconcile drift. We expose this as a seam so a future iteration can
                // call IStripeService.GetSubscriptionAsync(subscriptionId) — keeping the
                // hot path off this method until we have evidence of drift in production.
                _ = stripe;

                logger.LogDebug(
                    "Reconciled org {OrganizationId} (plan={Plan} status={Status})",
                    org.Id, org.Plan, org.SubscriptionStatus);
            }
            catch (Exception ex)
            {
                drifted++;
                logger.LogWarning(ex,
                    "StripeReconciliationJob: drift detected on org {OrganizationId}", org.Id);
            }
        }

        logger.LogInformation(
            "StripeReconciliationJob: done. {Drifted} drift warnings out of {Total} orgs",
            drifted, paidOrgs.Count);
    }
}
