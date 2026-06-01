using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Infrastructure.Jobs;

namespace StackSift.Tests.Infrastructure.Jobs;

public class LogRetentionJobTests
{
    // ─────────────────────────────────────────────────────────────────────────
    // Test 1: two orgs with different plans — correct cutoffs applied
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ExecuteAsync_TwoOrgsDifferentPlans_AppliesPlanSpecificCutoffs()
    {
        var freeOrgId = Guid.NewGuid();
        var teamOrgId = Guid.NewGuid();
        var tolerance = TimeSpan.FromSeconds(5);
        var now = DateTimeOffset.UtcNow;

        var mockOrgs = new Mock<IOrganizationRepository>();
        mockOrgs
            .Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync([
                new Organization { Id = freeOrgId, Plan = Plan.Free },
                new Organization { Id = teamOrgId, Plan = Plan.Team },
            ]);

        var mockLogs = new Mock<ILogEntryRepository>();
        mockLogs
            .Setup(r => r.DeleteOlderThanAsync(
                It.IsAny<Guid>(), It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var sut = new LogRetentionJob(
            mockOrgs.Object, mockLogs.Object,
            NullLogger<LogRetentionJob>.Instance,
            new FakeCurrentOrgProvider());

        await sut.ExecuteAsync(CancellationToken.None);

        // Free org → 3-day cutoff (docs/retention.md canonical table; Plan 09 §9.6).
        mockLogs.Verify(
            r => r.DeleteOlderThanAsync(
                freeOrgId,
                It.Is<DateTimeOffset>(d => Math.Abs((d - now.AddDays(-3)).TotalSeconds) <= tolerance.TotalSeconds),
                It.IsAny<CancellationToken>()),
            Times.Once);

        // Team org → 90-day cutoff
        mockLogs.Verify(
            r => r.DeleteOlderThanAsync(
                teamOrgId,
                It.Is<DateTimeOffset>(d => Math.Abs((d - now.AddDays(-90)).TotalSeconds) <= tolerance.TotalSeconds),
                It.IsAny<CancellationToken>()),
            Times.Once);
    }
}
