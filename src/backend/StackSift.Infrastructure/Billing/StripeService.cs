using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using StackSift.Application.Interfaces;
using StackSift.Infrastructure.Configuration;
using Stripe;

namespace StackSift.Infrastructure.Billing;

public sealed class StripeService(
    IOptions<StripeOptions> opts,
    ILogger<StripeService> logger) : IStripeService
{
    private readonly StripeClient _client = new(opts.Value.ApiKey);
    private readonly StripeOptions _opts = opts.Value;

    public async Task<StripeCustomerResult> EnsureCustomerAsync(
        Guid organizationId, string orgName, string adminEmail, CancellationToken ct)
    {
        var customers = new CustomerService(_client);

        var search = await customers.SearchAsync(new CustomerSearchOptions
        {
            Query = $"metadata['organization_id']:'{organizationId}'",
        }, cancellationToken: ct);

        if (search.Data.Count > 0)
            return new StripeCustomerResult(search.Data[0].Id);

        var created = await customers.CreateAsync(new CustomerCreateOptions
        {
            Email = adminEmail,
            Name = orgName,
            Metadata = new Dictionary<string, string>
            {
                ["organization_id"] = organizationId.ToString(),
            },
        }, cancellationToken: ct);

        logger.LogInformation(
            "Stripe customer created {CustomerId} for org {OrganizationId}",
            created.Id, organizationId);

        return new StripeCustomerResult(created.Id);
    }

    public async Task<StripeCheckoutResult> CreateCheckoutSessionAsync(
        string customerId,
        string priceId,
        string idempotencyKey,
        IReadOnlyDictionary<string, string> metadata,
        CancellationToken ct)
    {
        var checkouts = new Stripe.Checkout.SessionService(_client);

        var options = new Stripe.Checkout.SessionCreateOptions
        {
            Customer = customerId,
            Mode = "subscription",
            LineItems = [new Stripe.Checkout.SessionLineItemOptions { Price = priceId, Quantity = 1 }],
            SuccessUrl = _opts.CheckoutSuccessUrl,
            CancelUrl = _opts.CheckoutCancelUrl,
            AllowPromotionCodes = false,
            ClientReferenceId = metadata.TryGetValue("organization_id", out var orgId) ? orgId : null,
            Metadata = metadata.ToDictionary(p => p.Key, p => p.Value),
            SubscriptionData = new Stripe.Checkout.SessionSubscriptionDataOptions
            {
                Metadata = metadata.ToDictionary(p => p.Key, p => p.Value),
            },
        };

        var requestOptions = new RequestOptions { IdempotencyKey = idempotencyKey };

        var session = await checkouts.CreateAsync(options, requestOptions, ct);

        return new StripeCheckoutResult(session.Id, session.Url);
    }

    public async Task<StripePortalResult> CreatePortalSessionAsync(string customerId, CancellationToken ct)
    {
        var portal = new Stripe.BillingPortal.SessionService(_client);

        var session = await portal.CreateAsync(new Stripe.BillingPortal.SessionCreateOptions
        {
            Customer = customerId,
            ReturnUrl = _opts.PortalReturnUrl,
        }, cancellationToken: ct);

        return new StripePortalResult(session.Url);
    }

    public VerifiedStripeEvent VerifyAndParseEvent(string rawJsonBody, string stripeSignatureHeader)
    {
        Event evt;
        try
        {
            evt = EventUtility.ConstructEvent(
                rawJsonBody,
                stripeSignatureHeader,
                _opts.WebhookSecret,
                throwOnApiVersionMismatch: false);
        }
        catch (StripeException ex)
        {
            throw new StripeSignatureException(ex.Message);
        }

        return new VerifiedStripeEvent(
            Id: evt.Id,
            Type: evt.Type,
            RawJson: rawJsonBody,
            Subscription: TryExtractSubscription(evt),
            Invoice: TryExtractInvoice(evt),
            Checkout: TryExtractCheckout(evt));
    }

    private static StripeSubscriptionPayload? TryExtractSubscription(Event evt)
    {
        if (evt.Data.Object is not Subscription sub) return null;

        var firstItem = sub.Items?.Data?.Count > 0 ? sub.Items.Data[0] : null;
        var priceId = firstItem?.Price?.Id ?? string.Empty;
        var periodEnd = firstItem?.CurrentPeriodEnd ?? sub.CancelAt ?? sub.EndedAt;

        return new StripeSubscriptionPayload(
            Id: sub.Id,
            CustomerId: sub.CustomerId ?? string.Empty,
            Status: sub.Status,
            PriceId: priceId,
            CurrentPeriodEnd: periodEnd,
            CancelAtPeriodEnd: sub.CancelAtPeriodEnd,
            Metadata: sub.Metadata ?? new Dictionary<string, string>());
    }

    private static StripeInvoicePayload? TryExtractInvoice(Event evt)
    {
        if (evt.Data.Object is not Invoice invoice) return null;

        var subscriptionId = invoice.Parent?.SubscriptionDetails?.SubscriptionId;

        return new StripeInvoicePayload(
            Id: invoice.Id,
            SubscriptionId: subscriptionId,
            CustomerId: invoice.CustomerId ?? string.Empty);
    }

    private static StripeCheckoutPayload? TryExtractCheckout(Event evt)
    {
        if (evt.Data.Object is not Stripe.Checkout.Session session) return null;

        return new StripeCheckoutPayload(
            Id: session.Id,
            CustomerId: session.CustomerId ?? string.Empty,
            SubscriptionId: session.SubscriptionId,
            ClientReferenceId: session.ClientReferenceId,
            Metadata: session.Metadata ?? new Dictionary<string, string>());
    }
}
