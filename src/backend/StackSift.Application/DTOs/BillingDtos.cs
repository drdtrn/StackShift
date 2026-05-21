using StackSift.Domain.Enums;

namespace StackSift.Application.DTOs;

public sealed record CheckoutSessionDto(string SessionId, string Url);

public sealed record PortalSessionDto(string Url);

public sealed record SubscriptionDto(
    Plan Plan,
    SubscriptionStatus Status,
    DateTimeOffset? CurrentPeriodEnd,
    bool CancelAtPeriodEnd,
    bool HasStripeCustomer);
