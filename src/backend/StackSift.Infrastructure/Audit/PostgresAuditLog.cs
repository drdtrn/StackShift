using StackSift.Application.Interfaces;
using StackSift.Domain.Entities;
using StackSift.Domain.Enums;
using StackSift.Domain.Interfaces;
using StackSift.Infrastructure.Persistence;

namespace StackSift.Infrastructure.Audit;

public sealed class PostgresAuditLog(AppDbContext db, ICurrentUserService currentUser) : IAuditLog
{
    public async Task WriteAsync(
        AuditEvent auditEvent,
        Guid organizationId,
        Guid? projectId,
        Guid? logSourceId,
        Guid? targetId,
        string? targetType,
        string? details,
        CancellationToken ct = default)
    {
        var entry = new AuditLogEntry
        {
            Id = Guid.NewGuid(),
            OrganizationId = organizationId,
            ActorUserId = currentUser.UserId == Guid.Empty ? null : currentUser.UserId,
            ActorEmail = string.IsNullOrWhiteSpace(currentUser.Email) ? null : currentUser.Email,
            Event = auditEvent,
            ProjectId = projectId,
            LogSourceId = logSourceId,
            TargetId = targetId,
            TargetType = targetType,
            Details = details,
            OccurredAt = DateTimeOffset.UtcNow,
        };

        await db.AuditLogEntries.AddAsync(entry, ct);
    }
}
