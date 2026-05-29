namespace StackSift.Application.Common;

public static class Anonymiser
{
    /// <summary>Returns a stable placeholder email of the form
    /// <c>deleted-&lt;first8&gt;@stacksift.invalid</c>. The <c>.invalid</c> TLD
    /// is reserved by RFC 2606 so the address can never be sent mail.</summary>
    public static string EmailForDeletedUser(Guid userId)
    {
        var first8 = userId.ToString("N")[..8];
        return $"deleted-{first8}@stacksift.invalid";
    }

    /// <summary>Returns the IPv4 sentinel used to scrub <c>actor_ip</c> columns
    /// during account erasure. Reserved per RFC 5735 (0.0.0.0/8 — "this network").</summary>
    public const string IpForDeletedUser = "0.0.0.0";
}
