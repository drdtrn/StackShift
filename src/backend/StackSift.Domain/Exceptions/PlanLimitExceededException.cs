using StackSift.Domain.Enums;

namespace StackSift.Domain.Exceptions;

public sealed class PlanLimitExceededException(string resource, int limit, Plan plan)
    : Exception($"Your {plan} plan allows up to {limit} {resource}. Upgrade to add more.")
{
    public string Resource { get; } = resource;
    public int Limit { get; } = limit;
    public Plan Plan { get; } = plan;
}
