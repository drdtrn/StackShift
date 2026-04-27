using StackSift.Application.DTOs;

namespace StackSift.Application.Interfaces;

public interface IAlertHubService
{
    Task BroadcastAlertAsync(AlertDto alert, CancellationToken ct = default);
}
