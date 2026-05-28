using StackSift.Domain.Enums;

namespace StackSift.Application.Interfaces;

public interface IAuditLog
{
    Task WriteAsync(
        AuditEvent auditEvent,
        Guid organizationId,
        Guid? projectId,
        Guid? logSourceId,
        Guid? targetId,
        string? targetType,
        string? details,
        CancellationToken ct = default);
}
