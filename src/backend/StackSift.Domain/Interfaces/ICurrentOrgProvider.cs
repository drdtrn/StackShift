namespace StackSift.Domain.Interfaces;

public interface ICurrentOrgProvider
{
    Guid OrgId { get; }
    Guid UserId { get; }
    bool HasOrg { get; }

    // True only inside an HTTP request (and outside a system scope). Background
    // consumers and Hangfire jobs run with this false, which disables the tenant
    // query filter so they can operate cross-org via their own explicit scoping.
    bool TenantFilterEnabled { get; }

    // True only while an EnterSystemScope is active. This is the explicit opt-in
    // that grants the Postgres RLS bypass; the mere absence of an HTTP context
    // does NOT imply it, so untrusted non-HTTP paths stay fail-closed.
    bool IsSystemScope { get; }

    IDisposable EnterSystemScope(string reason);
}
