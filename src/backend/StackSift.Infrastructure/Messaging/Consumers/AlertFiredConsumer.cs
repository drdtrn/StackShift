using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using StackSift.Application.Interfaces;
using StackSift.Application.Messages;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Messaging.Consumers;

public sealed class AlertFiredConsumer(
    AppDbContext db,
    IAlertHubService alertHub,
    ILogger<AlertFiredConsumer> logger)
    : IConsumer<AlertFiredMessage>
{
    public async Task Consume(ConsumeContext<AlertFiredMessage> context)
    {
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

        logger.LogInformation(
            "Alert {AlertId} broadcast dispatched for incident {IncidentId}",
            msg.AlertId, msg.IncidentId);
    }
}
