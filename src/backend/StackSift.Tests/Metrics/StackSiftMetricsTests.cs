using StackSift.Api.Observability;

namespace StackSift.Tests.Metrics;

public sealed class StackSiftMetricsTests
{
    [Fact]
    public void BoundOrgLabel_RollsAdditionalOrganizationsIntoOther()
    {
        var metrics = new StackSiftMetrics();
        var labels = Enumerable.Range(0, StackSiftMetrics.MaxOrgLabels + 25)
            .Select(_ => metrics.BoundOrgLabel(Guid.NewGuid()))
            .ToList();

        Assert.Equal(StackSiftMetrics.MaxOrgLabels, labels.Count(label => label != "_other"));
        Assert.Equal(25, labels.Count(label => label == "_other"));
    }

    [Fact]
    public void AiAnalysisDurationBuckets_IncludeLongRunningAnalysisBoundaries()
    {
        Assert.Contains(30, StackSiftMetrics.AiAnalysisDurationBuckets);
        Assert.Contains(60, StackSiftMetrics.AiAnalysisDurationBuckets);
    }
}
