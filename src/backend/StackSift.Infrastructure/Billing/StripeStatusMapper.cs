using StackSift.Domain.Enums;

namespace StackSift.Infrastructure.Billing;

public static class StripeStatusMapper
{
    public static SubscriptionStatus Map(string stripeStatus) => stripeStatus switch
    {
        "active" or "trialing" => SubscriptionStatus.Active,
        "past_due" or "unpaid" => SubscriptionStatus.PastDue,
        "canceled" or "incomplete_expired" => SubscriptionStatus.Canceled,
        _ => SubscriptionStatus.None,
    };
}
