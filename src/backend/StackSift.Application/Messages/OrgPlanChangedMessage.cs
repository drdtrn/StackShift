using StackSift.Domain.Enums;

namespace StackSift.Application.Messages;

public record OrgPlanChangedMessage(
    Guid OrganizationId,
    Plan NewPlan,
    SubscriptionStatus Status,
    DateTimeOffset? CurrentPeriodEnd);
