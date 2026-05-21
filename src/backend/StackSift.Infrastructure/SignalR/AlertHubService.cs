using Microsoft.AspNetCore.SignalR;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;

namespace StackSift.Infrastructure.SignalR;

internal sealed class AlertHubService(IHubContext<AlertHub, IAlertHubClient> hub) : IAlertHubService
{
    public Task BroadcastLogEntryAsync(LogEntryDto entry, CancellationToken ct = default) =>
        hub.Clients.Group($"project-{entry.ProjectId}").ReceiveLogEntry(entry);

    public Task BroadcastAlertAsync(AlertDto alert, CancellationToken ct = default) =>
        hub.Clients.Group($"project-{alert.ProjectId}").ReceiveAlert(alert);

    public Task BroadcastAiAnalysisCompletedAsync(AiAnalysisDto analysis, CancellationToken ct = default) =>
        hub.Clients.Group($"project-{analysis.ProjectId}").ReceiveAiAnalysisCompleted(analysis);

    public Task BroadcastSubscriptionUpdatedAsync(Guid organizationId, SubscriptionDto subscription, CancellationToken ct = default) =>
        hub.Clients.Group($"org-{organizationId}").ReceiveSubscriptionUpdated(subscription);
}