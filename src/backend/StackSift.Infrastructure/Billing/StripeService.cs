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

    public async Task<StripePortalResult> CreatePortalSessionAsync(
        string customerId, StripePortalFlow? flow, CancellationToken ct)
    {
        var portal = new Stripe.BillingPortal.SessionService(_client);

        var options = new Stripe.BillingPortal.SessionCreateOptions
        {
            Customer = customerId,
            ReturnUrl = _opts.PortalReturnUrl,
        };

        // Deep-link into the plan-update flow when the caller asks for it. Stripe
        // returns a 400 if the portal is not configured for subscription updates,
        // which we surface to the caller as a normal Stripe exception.
        if (flow is { Type: "subscription_update", SubscriptionId: { Length: > 0 } subId })
        {
            options.FlowData = new Stripe.BillingPortal.SessionFlowDataOptions
            {
                Type = "subscription_update",
                SubscriptionUpdate = new Stripe.BillingPortal.SessionFlowDataSubscriptionUpdateOptions
                {
                    Subscription = subId,
                },
                AfterCompletion = new Stripe.BillingPortal.SessionFlowDataAfterCompletionOptions
                {
                    Type = "redirect",
                    Redirect = new Stripe.BillingPortal.SessionFlowDataAfterCompletionRedirectOptions
                    {
                        ReturnUrl = _opts.PortalReturnUrl,
                    },
                },
            };
        }

        var session = await portal.CreateAsync(options, cancellationToken: ct);
        return new StripePortalResult(session.Url);
    }

    public async Task<StripeCheckoutSessionLookup?> GetCheckoutSessionAsync(
        string sessionId, CancellationToken ct)
    {
        var checkouts = new Stripe.Checkout.SessionService(_client);

        try
        {
            var session = await checkouts.GetAsync(sessionId, cancellationToken: ct);
            return new StripeCheckoutSessionLookup(
                Id: session.Id,
                PaymentStatus: session.PaymentStatus ?? string.Empty,
                Status: session.Status ?? string.Empty,
                CustomerId: session.CustomerId,
                SubscriptionId: session.SubscriptionId,
                ClientReferenceId: session.ClientReferenceId,
                Metadata: session.Metadata ?? new Dictionary<string, string>());
        }
        catch (StripeException ex) when (ex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
        {
            logger.LogWarning("Stripe checkout session {SessionId} not found", sessionId);
            return null;
        }
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
