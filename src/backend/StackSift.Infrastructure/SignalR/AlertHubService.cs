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
}