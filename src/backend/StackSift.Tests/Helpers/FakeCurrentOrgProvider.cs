using StackSift.Domain.Interfaces;

namespace StackSift.Tests.Helpers;

public sealed class FakeCurrentOrgProvider : ICurrentOrgProvider
{
    public Guid OrgId { get; set; } = Guid.Empty;
    public Guid UserId { get; set; } = Guid.Empty;
    public bool HasOrg => OrgId != Guid.Empty;
    public bool TenantFilterEnabled { get; set; }

    public IDisposable EnterSystemScope(string reason)
    {
        var previous = TenantFilterEnabled;
        TenantFilterEnabled = false;
        return new Restorer(this, previous);
    }

    private sealed class Restorer(FakeCurrentOrgProvider owner, bool previous) : IDisposable
    {
        public void Dispose() => owner.TenantFilterEnabled = previous;
    }
}
