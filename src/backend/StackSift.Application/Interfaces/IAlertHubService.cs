using StackSift.Application.DTOs;

namespace StackSift.Application.Interfaces;

public interface IAlertHubService
{
    Task BroadcastLogEntryAsync(LogEntryDto entry, CancellationToken ct = default);
    Task BroadcastAlertAsync(AlertDto alert, CancellationToken ct = default);
    Task BroadcastAiAnalysisCompletedAsync(AiAnalysisDto analysis, CancellationToken ct = default);
}
