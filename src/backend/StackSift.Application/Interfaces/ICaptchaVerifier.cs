namespace StackSift.Application.Interfaces;

public interface ICaptchaVerifier
{
    // False in dev/test (no secret configured) so the verification step is skipped.
    bool Enabled { get; }

    Task<bool> VerifyAsync(string? token, string? remoteIp, CancellationToken ct = default);
}
