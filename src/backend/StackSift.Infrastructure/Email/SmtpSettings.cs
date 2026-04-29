namespace StackSift.Infrastructure.Email;

public sealed class SmtpSettings
{
    public string Host { get; init; } = "localhost";
    public int Port { get; init; } = 1025;
    public string? Username { get; init; }
    public string? Password { get; init; }
    public string FromAddress { get; init; } = "noreply@stacksift.io";
    public string FromName { get; init; } = "StackSift";
    public bool UseSsl { get; init; }

    /// <summary>
    /// Polly retry delays between send attempts. Override with TimeSpan.Zero in tests.
    /// Production default: 2 s → 8 s → 32 s.
    /// </summary>
    public TimeSpan[] RetryDelays { get; init; } =
    [
        TimeSpan.FromSeconds(2),
        TimeSpan.FromSeconds(8),
        TimeSpan.FromSeconds(32),
    ];
}
