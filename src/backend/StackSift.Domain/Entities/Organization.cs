using StackSift.Domain.Common;
using StackSift.Domain.Enums;

namespace StackSift.Domain.Entities;

public class Organization : AuditableEntity<Guid>
{
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string? LogoUrl { get; set; }
    public Plan Plan { get; set; } = Plan.Free;

    public string? StripeCustomerId { get; set; }
    public string? StripeSubscriptionId { get; set; }
    public string? StripePriceId { get; set; }
    public SubscriptionStatus SubscriptionStatus { get; set; } = SubscriptionStatus.None;
    public DateTimeOffset? CurrentPeriodEnd { get; set; }
    public bool CancelAtPeriodEnd { get; set; }
}
