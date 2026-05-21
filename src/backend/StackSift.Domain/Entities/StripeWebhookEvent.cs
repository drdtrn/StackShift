using StackSift.Domain.Common;

namespace StackSift.Domain.Entities;

public class StripeWebhookEvent : AuditableEntity<Guid>
{
    public string EventId { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public DateTimeOffset ReceivedAt { get; set; }
    public DateTimeOffset? ProcessedAt { get; set; }
    public string? ProcessingError { get; set; }
    public string PayloadJson { get; set; } = string.Empty;
}
