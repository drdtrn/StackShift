using FluentAssertions;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Billing;

namespace StackSift.Tests.Infrastructure.Billing;

public class StripeStatusMapperTests
{
    [Theory]
    [InlineData("active", SubscriptionStatus.Active)]
    [InlineData("trialing", SubscriptionStatus.Active)]
    [InlineData("past_due", SubscriptionStatus.PastDue)]
    [InlineData("unpaid", SubscriptionStatus.PastDue)]
    [InlineData("canceled", SubscriptionStatus.Canceled)]
    [InlineData("incomplete_expired", SubscriptionStatus.Canceled)]
    [InlineData("incomplete", SubscriptionStatus.None)]
    [InlineData("anything_else", SubscriptionStatus.None)]
    [InlineData("", SubscriptionStatus.None)]
    public void Map_TranslatesStripeStatusToInternalEnum(string stripeStatus, SubscriptionStatus expected)
    {
        StripeStatusMapper.Map(stripeStatus).Should().Be(expected);
    }
}
