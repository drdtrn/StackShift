using Hangfire;
using Hangfire.Common;
using Hangfire.States;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;
using StackSift.Application.Messages;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Infrastructure.Jobs;
using StackSift.Infrastructure.Messaging.Consumers;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Tests.Infrastructure.Messaging;

public class AlertFiredConsumerTests
{
    private static AppDbContext CreateDb()
    {
        var mockUser = new Mock<StackSift.Domain.Interfaces.ICurrentUserService>();
        mockUser.Setup(u => u.IsAuthenticated).Returns(false);
        mockUser.Setup(u => u.Email).Returns("system");
        return new AppDbContext(
            new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase($"consumer-{Guid.NewGuid()}")
                .Options,
            mockUser.Object);
    }

    private static Mock<ConsumeContext<AlertFiredMessage>> BuildContext(Alert alert) =>
        BuildContext(alert.Id, alert.IncidentId ?? Guid.Empty, alert.Severity);

    private static Mock<ConsumeContext<AlertFiredMessage>> BuildContext(Guid alertId, Guid incidentId, AlertSeverity severity)
    {
        var mock = new Mock<ConsumeContext<AlertFiredMessage>>();
        mock.Setup(c => c.Message).Returns(new AlertFiredMessage(
            Guid.NewGuid(), Guid.NewGuid(), alertId, incidentId, severity));
        mock.Setup(c => c.CancellationToken).Returns(CancellationToken.None);
        return mock;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 1: Critical alert — ImmediateAlertEmailJob is enqueued
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Consume_CriticalSeverity_EnqueuesImmediateAlertJob()
    {
        await using var db = CreateDb();
        var orgId = Guid.NewGuid();
        var alert = new Alert
        {
            Id = Guid.NewGuid(),
            OrganizationId = orgId,
            Severity = AlertSeverity.Critical,
            Title = "CPU Overload",
            FiredAt = DateTimeOffset.UtcNow,
        };
        db.Alerts.Add(alert);
        await db.SaveChangesAsync();

        var mockHub = new Mock<IAlertHubService>();
        mockHub
            .Setup(h => h.BroadcastAlertAsync(It.IsAny<AlertDto>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var mockJobs = new Mock<IBackgroundJobClient>();
        mockJobs
            .Setup(j => j.Create(It.IsAny<Job>(), It.IsAny<IState>()))
            .Returns("job-1");

        var consumer = new AlertFiredConsumer(
            db, mockHub.Object, mockJobs.Object,
            NullLogger<AlertFiredConsumer>.Instance);

        await consumer.Consume(BuildContext(alert).Object);

        mockJobs.Verify(j => j.Create(It.IsAny<Job>(), It.IsAny<IState>()), Times.Once);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 2: Low-severity alert — no job enqueued
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task Consume_LowSeverity_DoesNotEnqueueImmediateAlertJob()
    {
        await using var db = CreateDb();
        var alert = new Alert
        {
            Id = Guid.NewGuid(),
            OrganizationId = Guid.NewGuid(),
            Severity = AlertSeverity.Low,
            Title = "Disk Usage",
            FiredAt = DateTimeOffset.UtcNow,
        };
        db.Alerts.Add(alert);
        await db.SaveChangesAsync();

        var mockHub = new Mock<IAlertHubService>();
        mockHub
            .Setup(h => h.BroadcastAlertAsync(It.IsAny<AlertDto>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var mockJobs = new Mock<IBackgroundJobClient>();

        var consumer = new AlertFiredConsumer(
            db, mockHub.Object, mockJobs.Object,
            NullLogger<AlertFiredConsumer>.Instance);

        await consumer.Consume(BuildContext(alert).Object);

        mockJobs.Verify(j => j.Create(It.IsAny<Job>(), It.IsAny<IState>()), Times.Never);
    }
}
