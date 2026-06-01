using StackSift.Domain.Interfaces;

namespace StackSift.Tests.Helpers;

public sealed class FakeCurrentOrgProvider : ICurrentOrgProvider
{
    public Guid OrgId { get; set; } = Guid.Empty;
    public Guid UserId { get; set; } = Guid.Empty;
    public bool HasOrg => OrgId != Guid.Empty;
    public bool TenantFilterEnabled { get; set; }
    public bool IsSystemScope { get; set; }

    public IDisposable EnterSystemScope(string reason)
    {
        var previousFilter = TenantFilterEnabled;
        var previousScope = IsSystemScope;
        TenantFilterEnabled = false;
        IsSystemScope = true;
        return new Restorer(this, previousFilter, previousScope);
    }

    private sealed class Restorer(FakeCurrentOrgProvider owner, bool previousFilter, bool previousScope) : IDisposable
    {
        public void Dispose()
        {
            owner.TenantFilterEnabled = previousFilter;
            owner.IsSystemScope = previousScope;
        }
    }
}
