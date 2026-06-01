using Hangfire;
using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackSift.Application.Interfaces;
using StackSift.Application.Messages;
using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces;
using StackSift.Infrastructure.Jobs;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Messaging.Consumers;

public sealed class AlertFiredConsumer(
    AppDbContext db,
    IAlertHubService alertHub,
    IBackgroundJobClient backgroundJobs,
    ILogger<AlertFiredConsumer> logger,
    ICurrentOrgProvider orgProvider)
    : IConsumer<AlertFiredMessage>
{
    public async Task Consume(ConsumeContext<AlertFiredMessage> context)
    {
        using var systemScope = orgProvider.EnterSystemScope(nameof(AlertFiredConsumer));
        var msg = context.Message;
        var ct = context.CancellationToken;

        var alert = await db.Alerts
            .FirstOrDefaultAsync(a => a.Id == msg.AlertId, ct);

        if (alert is null)
        {
            logger.LogWarning("AlertFiredConsumer: Alert {AlertId} not found — skipping broadcast", msg.AlertId);
            return;
        }

        var alertDto = new Application.DTOs.AlertDto(
            alert.Id,
            alert.ProjectId,
            alert.OrganizationId,
            alert.AlertRuleId,
            alert.Severity,
            alert.Title,
            alert.Description,
            alert.FiredAt,
            alert.AcknowledgedAt,
            alert.ResolvedAt,
            alert.IncidentId);

        await alertHub.BroadcastAlertAsync(alertDto, ct);

        if (alert.Severity is AlertSeverity.Critical or AlertSeverity.High)
        {
            backgroundJobs.Enqueue<ImmediateAlertEmailJob>(
                j => j.ExecuteAsync(alert.Id, CancellationToken.None));
        }

        logger.LogInformation(
            "Alert {AlertId} broadcast dispatched for incident {IncidentId}",
            msg.AlertId, msg.IncidentId);
    }
}
