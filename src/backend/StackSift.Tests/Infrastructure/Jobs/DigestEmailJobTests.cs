using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces;
using StackSift.Domain.Interfaces.Repositories;
using StackSift.Domain.ValueObjects;
using StackSift.Infrastructure.Configuration;
using StackSift.Infrastructure.Jobs;

namespace StackSift.Tests.Infrastructure.Jobs;

public class DigestEmailJobTests
{
    private static IOptions<AppOptions> Options() =>
        Microsoft.Extensions.Options.Options.Create(new AppOptions { FrontendBaseUrl = "http://localhost:3000" });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 1: two orgs each with 2 admins — 4 digest emails sent
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ExecuteAsync_TwoOrgsWithIncidents_SendsDigestPerAdmin()
    {
        var org1 = Guid.NewGuid();
        var org2 = Guid.NewGuid();
        var since = DateTimeOffset.UtcNow.AddDays(-1);

        var mockIncidents = new Mock<IIncidentRepository>();
        mockIncidents
            .Setup(r => r.GetOrganizationIdsWithIncidentsSinceAsync(
                It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([org1, org2]);

        mockIncidents
            .Setup(r => r.GetCreatedSinceByOrgIdAsync(
                It.IsAny<Guid>(), It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([
                new Incident { Id = Guid.NewGuid(), Title = "Test Incident", Severity = AlertSeverity.High, Status = IncidentStatus.Open, StartedAt = DateTimeOffset.UtcNow },
            ]);

        var mockUsers = new Mock<IUserRepository>();
        mockUsers
            .Setup(r => r.GetAdminsByOrgIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([
                new User { Id = Guid.NewGuid(), Email = "admin1@test.io" },
                new User { Id = Guid.NewGuid(), Email = "admin2@test.io" },
            ]);

        var mockEmail = new Mock<IEmailService>();
        mockEmail
            .Setup(e => e.SendAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var sut = new DigestEmailJob(
            mockIncidents.Object, mockUsers.Object, mockEmail.Object,
            Options(), NullLogger<DigestEmailJob>.Instance);

        await sut.ExecuteAsync(CancellationToken.None);

        // 2 orgs × 2 admins = 4 emails, all with the correct subject prefix
        mockEmail.Verify(
            e => e.SendAsync(
                It.Is<EmailMessage>(m => m.Subject.StartsWith("StackSift Daily Digest — ")),
                It.IsAny<CancellationToken>()),
            Times.Exactly(4));
    }
}
