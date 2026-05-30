using StackSift.Domain.Interfaces;

namespace StackSift.MigrationRunner;

// The migration runner has no HTTP context and operates cross-org by design,
// so the tenant query filter must be disabled — same contract as the
// SystemCurrentOrgProvider used by the design-time factory.
internal sealed class MigrationCurrentOrgProvider : ICurrentOrgProvider
{
    public Guid OrgId => Guid.Empty;
    public Guid UserId => Guid.Empty;
    public bool HasOrg => false;
    public bool TenantFilterEnabled => false;
    public IDisposable EnterSystemScope(string reason) => new NoopScope();

    private sealed class NoopScope : IDisposable
    {
        public void Dispose() { }
    }
}
