using Microsoft.EntityFrameworkCore;
using StackSift.Application.Commands.Billing;
using StackSift.Domain.Entities;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Billing;

public sealed class StripeWebhookStore(AppDbContext db) : IStripeWebhookStore
{
    public Task<StripeWebhookEvent?> FindByEventIdAsync(string eventId, CancellationToken ct) =>
        db.StripeWebhookEvents.FirstOrDefaultAsync(e => e.EventId == eventId, ct);

    public async Task AddAsync(StripeWebhookEvent record, CancellationToken ct) =>
        await db.StripeWebhookEvents.AddAsync(record, ct);

    public Task SaveChangesAsync(CancellationToken ct) => db.SaveChangesAsync(ct);

    public async Task<Organization?> FindOrgBySubscriptionOrCustomerAsync(
        string subscriptionId,
        string customerId,
        IReadOnlyDictionary<string, string> metadata,
        CancellationToken ct)
    {
        if (metadata.TryGetValue("organization_id", out var orgIdStr) &&
            Guid.TryParse(orgIdStr, out var orgId))
        {
            var byMeta = await db.Organizations.FirstOrDefaultAsync(o => o.Id == orgId, ct);
            if (byMeta is not null) return byMeta;
        }

        return await db.Organizations.FirstOrDefaultAsync(
            o => o.StripeSubscriptionId == subscriptionId || o.StripeCustomerId == customerId, ct);
    }

    public Task<Organization?> FindOrgBySubscriptionIdAsync(string subscriptionId, CancellationToken ct) =>
        db.Organizations.FirstOrDefaultAsync(o => o.StripeSubscriptionId == subscriptionId, ct);
}
