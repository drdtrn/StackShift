using StackSift.Domain.Enums;

namespace StackSift.Application.Messages;

public record AlertFiredMessage(
    Guid OrganizationId,
    Guid ProjectId,
    Guid AlertId,
    Guid IncidentId,
    AlertSeverity Severity
);
