using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using StackSift.Application.Interfaces;
using StackSift.Infrastructure.Configuration;

namespace StackSift.Infrastructure.Identity;

/// <summary>
/// HMAC-SHA256 hasher for the single-use cancellation token sent to a user
/// who issued <c>DELETE /api/v1/account</c>. The raw token is mailed; only the
/// hash is stored. Reuses the LogSources pepper option for cipher material —
/// the two use-cases share the threat model (a leaked DB without the pepper
/// must remain unusable).
/// </summary>
public sealed class HmacErasureCancellationTokenHasher : IErasureCancellationTokenHasher
{
    private const string Prefix = "ec_";
    private readonly byte[] _pepper;

    public HmacErasureCancellationTokenHasher(IOptions<LogSourceOptions> options)
    {
        _pepper = DecodePepper(options.Value.KeyPepperBase64);
    }

    public string Generate()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        var body = Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
        return $"{Prefix}{body}";
    }

    public string Hash(string token)
    {
        using var hmac = new HMACSHA256(_pepper);
        var bytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static byte[] DecodePepper(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException("LogSources:KeyPepperBase64 is required.");
        byte[] pepper;
        try
        {
            pepper = Convert.FromBase64String(value);
        }
        catch (FormatException ex)
        {
            throw new InvalidOperationException("LogSources:KeyPepperBase64 must be valid base64.", ex);
        }
        if (pepper.Length < 32)
            throw new InvalidOperationException("LogSources:KeyPepperBase64 must decode to at least 32 bytes.");
        return pepper;
    }
}
