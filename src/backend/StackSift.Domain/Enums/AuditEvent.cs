namespace StackSift.Domain.Enums;

public enum AuditEvent
{
    LogSourceKeyCreated,
    LogSourceKeyRevealed,
    LogSourceKeyRegenerated,
    LogSourceDeleted,
    LogSourceTestIngestSent,
    MemberInvited,
    MemberRoleChanged,
    MemberRemoved,
    UserSignedIn,
    UserSignedOut,
    OrganizationUpdated,
    PlanUpgraded,
    PlanDowngraded,
    DataExportRequested,
    DataErasureRequested
}
