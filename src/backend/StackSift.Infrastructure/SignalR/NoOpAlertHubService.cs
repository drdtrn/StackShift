using Microsoft.Extensions.Logging;
using StackSift.Application.DTOs;
using StackSift.Application.Interfaces;

namespace StackSift.Infrastructure.SignalR;

// Stub until BE-08 wires the real SignalR AlertHub.
internal sealed class NoOpAlertHubService(ILogger<NoOpAlertHubService> logger) : IAlertHubService
{
    public Task BroadcastAlertAsync(AlertDto alert, CancellationToken ct = default)
    {
        logger.LogInformation(
            "Alert broadcast stub (SignalR not yet wired — BE-08). AlertId: {AlertId}, Severity: {Severity}",
            alert.Id, alert.Severity);
        return Task.CompletedTask;
    }
}
