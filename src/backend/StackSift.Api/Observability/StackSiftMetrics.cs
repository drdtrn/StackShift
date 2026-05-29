using System.Collections.Concurrent;
using Prometheus;
using StackSift.Application.Interfaces;
using StackSift.Domain.Enums;

namespace StackSift.Api.Observability;

public sealed class StackSiftMetrics : IStackSiftMetrics
{
    public const int MaxOrgLabels = 100;
    public static readonly double[] AiAnalysisDurationBuckets = [1, 5, 10, 30, 60, 120, 300];

    private static readonly Counter LogsIngested = Metrics.CreateCounter(
        "stacksift_logs_ingested_total",
        "Total log entries ingested by StackSift.",
        new CounterConfiguration { LabelNames = ["org_id"] });

    private static readonly Counter AiAnalyses = Metrics.CreateCounter(
        "stacksift_ai_analyses_total",
        "Total AI analyses by terminal status.",
        new CounterConfiguration { LabelNames = ["status"] });

    private static readonly Histogram AiAnalysisDuration = Metrics.CreateHistogram(
        "stacksift_ai_analysis_duration_seconds",
        "AI analysis duration in seconds.",
        new HistogramConfiguration
        {
            Buckets = AiAnalysisDurationBuckets,
        });

    private static readonly Counter AlertsFired = Metrics.CreateCounter(
        "stacksift_alerts_fired_total",
        "Total alerts fired by severity.",
        new CounterConfiguration { LabelNames = ["severity"] });

    private static readonly Gauge OpenIncidents = Metrics.CreateGauge(
        "stacksift_open_incidents",
        "Current open incidents.");

    private static readonly Counter StripeWebhookEvents = Metrics.CreateCounter(
        "stacksift_stripe_webhook_events_total",
        "Stripe webhook events by event type and outcome.",
        new CounterConfiguration { LabelNames = ["event_type", "outcome"] });

    private readonly ConcurrentDictionary<Guid, byte> orgLabels = new();

    public void RecordLogsIngested(Guid organizationId, int count)
    {
        if (count <= 0) return;
        LogsIngested.WithLabels(BoundOrgLabel(organizationId)).Inc(count);
    }

    public void RecordAiAnalysis(string status, double durationSeconds)
    {
        AiAnalyses.WithLabels(status).Inc();
        if (durationSeconds >= 0)
            AiAnalysisDuration.Observe(durationSeconds);
    }

    public void RecordAlertFired(AlertSeverity severity) =>
        AlertsFired.WithLabels(severity.ToString().ToLowerInvariant()).Inc();

    public void SetOpenIncidents(int count) =>
        OpenIncidents.Set(Math.Max(0, count));

    public void RecordStripeWebhookEvent(string eventType, string outcome) =>
        StripeWebhookEvents.WithLabels(eventType, outcome).Inc();

    public string BoundOrgLabel(Guid organizationId)
    {
        if (orgLabels.ContainsKey(organizationId))
            return organizationId.ToString();

        if (orgLabels.Count >= MaxOrgLabels)
            return "_other";

        orgLabels.TryAdd(organizationId, 0);
        return organizationId.ToString();
    }

}
