using FluentAssertions;
using StackSift.Domain;
using StackSift.Domain.Enums;

namespace StackSift.Tests.Domain;

public class PlanLimitsTests
{
    [Fact]
    public void Free_HasOneProjectOneUserTenAnalyses()
    {
        var limit = PlanLimits.Map[Plan.Free];
        limit.MaxProjects.Should().Be(1);
        limit.MaxUsers.Should().Be(1);
        limit.MaxAiAnalysesPerMonth.Should().Be(10);
    }

    [Fact]
    public void Indie_HasFiveProjectsOneUserHundredAnalyses()
    {
        var limit = PlanLimits.Map[Plan.Indie];
        limit.MaxProjects.Should().Be(5);
        limit.MaxUsers.Should().Be(1);
        limit.MaxAiAnalysesPerMonth.Should().Be(100);
    }

    [Fact]
    public void Team_IsEffectivelyUnlimited()
    {
        var limit = PlanLimits.Map[Plan.Team];
        limit.MaxProjects.Should().Be(int.MaxValue);
        limit.MaxUsers.Should().Be(int.MaxValue);
        limit.MaxAiAnalysesPerMonth.Should().Be(int.MaxValue);
    }

    [Fact]
    public void Map_CoversEveryPlanEnumValue()
    {
        foreach (var plan in Enum.GetValues<Plan>())
        {
            PlanLimits.Map.ContainsKey(plan).Should().BeTrue($"PlanLimits must cover {plan}");
        }
    }
}
