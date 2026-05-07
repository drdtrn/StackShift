using Microsoft.EntityFrameworkCore;
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
using StackSift.Infrastructure.Persistence;
using StackSift.Tests.Helpers;

namespace StackSift.Tests.Infrastructure.Jobs;

public class ImmediateAlertEmailJobTests
{
    private static AppDbContext CreateDb() => TestAppDbContext.Create();

    private static IOptions<AppOptions> Options() =>
        Microsoft.Extensions.Options.Options.Create(new AppOptions { FrontendBaseUrl = "http://localhost:3000" });

    // ─────────────────────────────────────────────────────────────────────────
    // Test 1: alert found — sends one email per admin/owner
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ExecuteAsync_AlertExists_SendsOneEmailPerAdmin()
    {
        await using var db = CreateDb();

        var orgId = Guid.NewGuid();
        var alertId = Guid.NewGuid();
        db.Alerts.Add(new Alert
        {
            Id = alertId,
            OrganizationId = orgId,
            Severity = AlertSeverity.Critical,
            Title = "CPU Spike",
            FiredAt = DateTimeOffset.UtcNow,
        });
        await db.SaveChangesAsync();

        var mockUsers = new Mock<IUserRepository>();
        mockUsers
            .Setup(r => r.GetAdminsByOrgIdAsync(orgId, It.IsAny<CancellationToken>()))
            .ReturnsAsync([
                new User { Id = Guid.NewGuid(), Email = "admin1@test.io", OrganizationId = orgId, Role = UserRole.Admin },
                new User { Id = Guid.NewGuid(), Email = "admin2@test.io", OrganizationId = orgId, Role = UserRole.Owner },
            ]);

        var mockEmail = new Mock<IEmailService>();
        mockEmail
            .Setup(e => e.SendAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var sut = new ImmediateAlertEmailJob(
            db, mockUsers.Object, mockEmail.Object,
            Options(), NullLogger<ImmediateAlertEmailJob>.Instance);

        await sut.ExecuteAsync(alertId, CancellationToken.None);

        mockEmail.Verify(
            e => e.SendAsync(
                It.Is<EmailMessage>(m => m.Subject.Contains("[Critical]") && m.Subject.Contains("CPU Spike")),
                It.IsAny<CancellationToken>()),
            Times.Exactly(2));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 2: alert not found — logs warning, sends nothing
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task ExecuteAsync_AlertNotFound_LogsWarningAndDoesNotSend()
    {
        await using var db = CreateDb();

        var mockUsers = new Mock<IUserRepository>();
        var mockEmail = new Mock<IEmailService>();

        var sut = new ImmediateAlertEmailJob(
            db, mockUsers.Object, mockEmail.Object,
            Options(), NullLogger<ImmediateAlertEmailJob>.Instance);

        await sut.ExecuteAsync(Guid.NewGuid(), CancellationToken.None);

        mockEmail.Verify(
            e => e.SendAsync(It.IsAny<EmailMessage>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }
}
