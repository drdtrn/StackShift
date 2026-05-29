using StackSift.Domain.Common;
using StackSift.Domain.Enums;

namespace StackSift.Domain.Entities;

public class AccountErasureRequest : AuditableEntity<Guid>
{
    public Guid UserId { get; set; }
    public AccountErasureStatus Status { get; set; } = AccountErasureStatus.PendingGrace;
    public DateTimeOffset RequestedAt { get; set; }
    public DateTimeOffset GraceEndsAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }

    /// <summary>HMAC-SHA256 (with the GDPR pepper) of the single-use cancellation token sent to the user.</summary>
    public string? CancellationTokenHash { get; set; }

    public string? AwaitingReviewReason { get; set; }
    public string? FailureReason { get; set; }
}
