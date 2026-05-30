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

    IDisposable EnterSystemScope(string reason);
}
