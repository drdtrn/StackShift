using StackSift.Application.DTOs;

namespace StackSift.Application.Interfaces;

public interface IAlertHubService
{
    Task BroadcastLogAlertAsync(LogEntryDto entry, CancellationToken ct = default);
    Task BroadcastAlertAsync(AlertDto alert, CancellationToken ct = default);
}
