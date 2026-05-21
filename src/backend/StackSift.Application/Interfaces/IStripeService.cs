namespace StackSift.Application.Interfaces;

public interface IStripeService
{
    Task<StripeCustomerResult> EnsureCustomerAsync(
        Guid organizationId, string orgName, string adminEmail, CancellationToken ct);

    Task<StripeCheckoutResult> CreateCheckoutSessionAsync(
        string customerId,
        string priceId,
        string idempotencyKey,
        IReadOnlyDictionary<string, string> metadata,
        CancellationToken ct);

    Task<StripePortalResult> CreatePortalSessionAsync(string customerId, CancellationToken ct);

    VerifiedStripeEvent VerifyAndParseEvent(string rawJsonBody, string stripeSignatureHeader);
}

public sealed record StripeCustomerResult(string CustomerId);
public sealed record StripeCheckoutResult(string SessionId, string Url);
public sealed record StripePortalResult(string Url);

public sealed record VerifiedStripeEvent(
    string Id,
    string Type,
    string RawJson,
    StripeSubscriptionPayload? Subscription,
    StripeInvoicePayload? Invoice,
    StripeCheckoutPayload? Checkout);

public sealed record StripeSubscriptionPayload(
    string Id,
    string CustomerId,
    string Status,
    string PriceId,
    DateTimeOffset? CurrentPeriodEnd,
    bool CancelAtPeriodEnd,
    IReadOnlyDictionary<string, string> Metadata);

public sealed record StripeInvoicePayload(
    string Id,
    string? SubscriptionId,
    string CustomerId);

public sealed record StripeCheckoutPayload(
    string Id,
    IReadOnlyDictionary<string, string> Metadata);

public sealed class StripeSignatureException(string message) : Exception(message);
