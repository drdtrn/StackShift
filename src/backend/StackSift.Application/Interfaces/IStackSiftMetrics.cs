using StackSift.Domain.Enums;

namespace StackSift.Application.Interfaces;

public interface IStackSiftMetrics
{
    void RecordLogsIngested(Guid organizationId, int count);
    void RecordAiAnalysis(string status, double durationSeconds);
    void RecordAlertFired(AlertSeverity severity);
    void SetOpenIncidents(int count);
    void RecordStripeWebhookEvent(string eventType, string outcome);
}
