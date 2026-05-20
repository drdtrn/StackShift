using StackSift.Domain.Enums;

namespace StackSift.Domain;

public sealed record PlanLimit(int MaxProjects, int MaxUsers, int MaxAiAnalysesPerMonth);

public static class PlanLimits
{
    public static readonly IReadOnlyDictionary<Plan, PlanLimit> Map = new Dictionary<Plan, PlanLimit>
    {
        [Plan.Free]  = new(MaxProjects: 1,            MaxUsers: 1,            MaxAiAnalysesPerMonth: 10),
        [Plan.Indie] = new(MaxProjects: 5,            MaxUsers: 1,            MaxAiAnalysesPerMonth: 100),
        [Plan.Team]  = new(MaxProjects: int.MaxValue, MaxUsers: int.MaxValue, MaxAiAnalysesPerMonth: int.MaxValue),
    };
}
