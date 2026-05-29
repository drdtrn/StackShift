using StackSift.Domain.Enums;

namespace StackSift.Application.Interfaces;

public sealed class NoOpStackSiftMetrics : IStackSiftMetrics
{
    public void RecordLogsIngested(Guid organizationId, int count) { }
    public void RecordAiAnalysis(string status, double durationSeconds) { }
    public void RecordAlertFired(AlertSeverity severity) { }
    public void SetOpenIncidents(int count) { }
    public void RecordStripeWebhookEvent(string eventType, string outcome) { }
}
