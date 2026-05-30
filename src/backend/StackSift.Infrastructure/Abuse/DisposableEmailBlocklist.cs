using StackSift.Application.Interfaces;

namespace StackSift.Infrastructure.Abuse;

public sealed class DisposableEmailBlocklist : IDisposableEmailBlocklist
{
    private static readonly string[] Seed =
    [
        "mailinator.com", "guerrillamail.com", "guerrillamail.info", "10minutemail.com",
        "tempmail.com", "temp-mail.org", "throwaway.email", "yopmail.com",
        "trashmail.com", "getnada.com", "dispostable.com", "maildrop.cc",
        "sharklasers.com", "fakeinbox.com", "mailnesia.com", "discard.email",
    ];

    private volatile HashSet<string> _domains = new(Seed, StringComparer.OrdinalIgnoreCase);

    public bool IsDisposable(string email)
    {
        var at = email.LastIndexOf('@');
        if (at < 0 || at == email.Length - 1) return false;
        var domain = email[(at + 1)..].Trim().ToLowerInvariant();
        return _domains.Contains(domain);
    }

    public void Replace(IEnumerable<string> domains)
        => _domains = new HashSet<string>(domains, StringComparer.OrdinalIgnoreCase);

    public int Count => _domains.Count;
}
