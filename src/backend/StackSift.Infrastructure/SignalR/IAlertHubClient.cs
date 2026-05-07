using StackSift.Application.DTOs;

namespace StackSift.Infrastructure.SignalR;

/// <summary>
/// Strongly-typed client surface for <see cref="AlertHub"/>. Method names are
/// the wire-level events the frontend subscribes to via
/// <c>connection.on('ReceiveLogEntry' | 'ReceiveAlert', handler)</c>.
/// Must match the constants in
/// <c>src/frontend/src/app/lib/signalr-config.ts</c>.
/// </summary>
public interface IAlertHubClient
{
    Task ReceiveLogEntry(LogEntryDto entry);
    Task ReceiveAlert(AlertDto alert);
    Task ReceiveAiAnalysisCompleted(AiAnalysisDto analysis);
}