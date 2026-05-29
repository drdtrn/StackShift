using MediatR;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Application.Messages;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;

namespace StackSift.Application.Commands.Billing;

public record ProcessStripeWebhookCommand(string RawBody, string Signature) : IRequest<Unit>;

public class ProcessStripeWebhookCommandHandler(
    IStripeWebhookStore store,
    IStripeService stripe,
    IMessagePublisher publisher,
    IAlertHubService alertHub,
    IOptions<BillingPriceMap> priceMap,
    IStackSiftMetrics metrics,
    ILogger<ProcessStripeWebhookCommandHandler> logger)
    : IRequestHandler<ProcessStripeWebhookCommand, Unit>
{
    public async Task<Unit> Handle(ProcessStripeWebhookCommand request, CancellationToken ct)
    {
        VerifiedStripeEvent evt;
        try
        {
            evt = stripe.VerifyAndParseEvent(request.RawBody, request.Signature);
        }
        catch (StripeSignatureException ex)
        {
            logger.LogWarning(ex, "Stripe webhook signature verification failed");
            metrics.RecordStripeWebhookEvent("unknown", "signature_failed");
            throw new FluentValidation.ValidationException("Invalid Stripe-Signature.");
        }

        var existing = await store.FindByEventIdAsync(evt.Id, ct);
        if (existing is { ProcessedAt: not null })
        {
            logger.LogInformation(
                "Replay of {EventId} ({Type}) — already processed at {Ts}",
                evt.Id, evt.Type, existing.ProcessedAt);
            return Unit.Value;
        }

        var record = existing ?? new StripeWebhookEvent
        {
            Id = Guid.NewGuid(),
            EventId = evt.Id,
            EventType = evt.Type,
            ReceivedAt = DateTimeOffset.UtcNow,
            PayloadJson = evt.RawJson,
        };
        if (existing is null) await store.AddAsync(record, ct);
        await store.SaveChangesAsync(ct);

        try
        {
            var outcome = "succeeded";
            switch (evt.Type)
            {
                case "checkout.session.completed":
                    await HandleCheckoutCompletedAsync(evt, ct);
                    break;
                case "customer.subscription.created":
                case "customer.subscription.updated":
                    await HandleSubscriptionChangedAsync(evt, ct);
                    break;
                case "customer.subscription.deleted":
                    await HandleSubscriptionDeletedAsync(evt, ct);
                    break;
                case "invoice.payment_failed":
                    await HandlePaymentFailedAsync(evt, ct);
                    break;
                case "invoice.payment_succeeded":
                    break;
                default:
                    logger.LogDebug("Unhandled Stripe event {Type}", evt.Type);
                    outcome = "unhandled";
                    break;
            }

            record.ProcessedAt = DateTimeOffset.UtcNow;
            await store.SaveChangesAsync(ct);
            metrics.RecordStripeWebhookEvent(evt.Type, outcome);
        }
        catch (Exception ex)
        {
            record.ProcessingError = ex.Message[..Math.Min(2000, ex.Message.Length)];
            await store.SaveChangesAsync(ct);
            metrics.RecordStripeWebhookEvent(evt.Type, "failed");
            throw;
        }

        return Unit.Value;
    }

    private async Task HandleCheckoutCompletedAsync(VerifiedStripeEvent evt, CancellationToken ct)
    {
        if (evt.Checkout is null) return;

        var orgIdRaw = evt.Checkout.Metadata.GetValueOrDefault("organization_id")
            ?? evt.Checkout.ClientReferenceId;

        if (!Guid.TryParse(orgIdRaw, out var orgId))
        {
            logger.LogWarning(
                "Checkout completed: session {SessionId} missing valid organization_id metadata",
                evt.Checkout.Id);
            return;
        }

        if (!TryResolvePaidPlan(evt.Checkout.Metadata.GetValueOrDefault("target_plan"), out var plan))
        {
            logger.LogWarning(
                "Checkout completed: session {SessionId} for org {OrganizationId} missing valid target_plan metadata",
                evt.Checkout.Id, orgId);
            return;
        }

        var org = await store.FindOrgByIdAsync(orgId, ct);
        if (org is null) { LogOrgNotFound(evt.Id, evt.Checkout.CustomerId); return; }

        if (!string.IsNullOrWhiteSpace(evt.Checkout.CustomerId))
            org.StripeCustomerId = evt.Checkout.CustomerId;

        if (!string.IsNullOrWhiteSpace(evt.Checkout.SubscriptionId))
            org.StripeSubscriptionId = evt.Checkout.SubscriptionId;

        org.Plan = plan;
        org.SubscriptionStatus = SubscriptionStatus.Active;

        await store.SaveChangesAsync(ct);
        await PublishPlanChangedAsync(org, ct);

        logger.LogInformation(
            "Checkout completed: session {SessionId} for org {OrganizationId}",
            evt.Checkout.Id, org.Id);
    }

    private async Task HandleSubscriptionChangedAsync(VerifiedStripeEvent evt, CancellationToken ct)
    {
        if (evt.Subscription is null) return;

        var sub = evt.Subscription;
        var org = await store.FindOrgBySubscriptionOrCustomerAsync(sub.Id, sub.CustomerId, sub.Metadata, ct);
        if (org is null) { LogOrgNotFound(evt.Id, sub.CustomerId); return; }

        org.StripeSubscriptionId = sub.Id;
        org.StripePriceId = sub.PriceId;
        org.SubscriptionStatus = MapStatus(sub.Status);
        org.Plan = ResolvePlanFromPriceId(sub.PriceId);
        org.CurrentPeriodEnd = sub.CurrentPeriodEnd;
        org.CancelAtPeriodEnd = sub.CancelAtPeriodEnd;

        await store.SaveChangesAsync(ct);
        await PublishPlanChangedAsync(org, ct);
    }

    private async Task HandleSubscriptionDeletedAsync(VerifiedStripeEvent evt, CancellationToken ct)
    {
        if (evt.Subscription is null) return;

        var sub = evt.Subscription;
        var org = await store.FindOrgBySubscriptionOrCustomerAsync(sub.Id, sub.CustomerId, sub.Metadata, ct);
        if (org is null) { LogOrgNotFound(evt.Id, sub.CustomerId); return; }

        org.Plan = Plan.Free;
        org.SubscriptionStatus = SubscriptionStatus.Canceled;
        org.StripeSubscriptionId = null;
        org.StripePriceId = null;
        org.CurrentPeriodEnd = null;
        org.CancelAtPeriodEnd = false;

        await store.SaveChangesAsync(ct);
        await PublishPlanChangedAsync(org, ct);
    }

    private async Task HandlePaymentFailedAsync(VerifiedStripeEvent evt, CancellationToken ct)
    {
        if (evt.Invoice is null || string.IsNullOrEmpty(evt.Invoice.SubscriptionId)) return;

        var org = await store.FindOrgBySubscriptionIdAsync(evt.Invoice.SubscriptionId, ct);
        if (org is null) { LogOrgNotFound(evt.Id, evt.Invoice.CustomerId); return; }

        org.SubscriptionStatus = SubscriptionStatus.PastDue;
        await store.SaveChangesAsync(ct);
        await PublishPlanChangedAsync(org, ct);
    }

    private Plan ResolvePlanFromPriceId(string priceId)
    {
        var map = priceMap.Value;
        if (priceId == map.Indie) return Plan.Indie;
        if (priceId == map.Team) return Plan.Team;
        return Plan.Free;
    }

    private static bool TryResolvePaidPlan(string? value, out Plan plan)
    {
        if (Enum.TryParse(value, ignoreCase: true, out plan) && plan is Plan.Indie or Plan.Team)
            return true;

        plan = Plan.Free;
        return false;
    }

    private static SubscriptionStatus MapStatus(string stripeStatus) => stripeStatus switch
    {
        "active" or "trialing" => SubscriptionStatus.Active,
        "past_due" or "unpaid" => SubscriptionStatus.PastDue,
        "canceled" or "incomplete_expired" => SubscriptionStatus.Canceled,
        _ => SubscriptionStatus.None,
    };

    private async Task PublishPlanChangedAsync(Organization org, CancellationToken ct)
    {
        await publisher.PublishAsync(
            new OrgPlanChangedMessage(org.Id, org.Plan, org.SubscriptionStatus, org.CurrentPeriodEnd), ct);

        var dto = new SubscriptionDto(
            Plan: org.Plan,
            Status: org.SubscriptionStatus,
            CurrentPeriodEnd: org.CurrentPeriodEnd,
            CancelAtPeriodEnd: org.CancelAtPeriodEnd,
            HasStripeCustomer: !string.IsNullOrEmpty(org.StripeCustomerId));

        await alertHub.BroadcastSubscriptionUpdatedAsync(org.Id, dto, ct);
    }

    private void LogOrgNotFound(string eventId, string customerId) =>
        logger.LogWarning(
            "Webhook {EventId}: no org matched Stripe customer {CustomerId}", eventId, customerId);
}

public interface IStripeWebhookStore
{
    Task<StripeWebhookEvent?> FindByEventIdAsync(string eventId, CancellationToken ct);
    Task AddAsync(StripeWebhookEvent record, CancellationToken ct);
    Task SaveChangesAsync(CancellationToken ct);
    Task<Organization?> FindOrgBySubscriptionOrCustomerAsync(
        string subscriptionId, string customerId, IReadOnlyDictionary<string, string> metadata, CancellationToken ct);
    Task<Organization?> FindOrgBySubscriptionIdAsync(string subscriptionId, CancellationToken ct);
    Task<Organization?> FindOrgByIdAsync(Guid organizationId, CancellationToken ct);
}
