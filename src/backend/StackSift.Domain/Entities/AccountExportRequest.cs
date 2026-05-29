using StackSift.Domain.Common;
using StackSift.Domain.Enums;

namespace StackSift.Domain.Entities;

public class AccountExportRequest : AuditableEntity<Guid>
{
    public Guid UserId { get; set; }
    public AccountExportStatus Status { get; set; } = AccountExportStatus.Pending;
    public DateTimeOffset RequestedAt { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
    public string? ObjectKey { get; set; }
    public string? SignedUrl { get; set; }
    public DateTimeOffset? ExpiresAt { get; set; }
    public string? ManifestSha256 { get; set; }
    public long? SizeBytes { get; set; }
    public string? FailureReason { get; set; }
}
