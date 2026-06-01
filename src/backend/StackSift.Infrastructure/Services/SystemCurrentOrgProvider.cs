using StackSift.Domain.Interfaces;

namespace StackSift.Infrastructure.Services;

// Used at design time (migrations) and any non-HTTP construction. The tenant
// filter is disabled, matching how background workers run.
internal sealed class SystemCurrentOrgProvider : ICurrentOrgProvider
{
    public Guid OrgId => Guid.Empty;
    public Guid UserId => Guid.Empty;
    public bool HasOrg => false;
    public bool TenantFilterEnabled => false;
    public bool IsSystemScope => true;
    public IDisposable EnterSystemScope(string reason) => new NoopScope();

    private sealed class NoopScope : IDisposable
    {
        public void Dispose() { }
    }
}
