using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using StackSift.Application.Interfaces;
using StackSift.Infrastructure.Configuration;

namespace StackSift.Infrastructure.Identity;

public sealed class HmacApiKeyHasher : IApiKeyHasher
{
    private const string Prefix = "ss_";
    private readonly byte[] _pepper;

    public HmacApiKeyHasher(IOptions<LogSourceOptions> options)
    {
        _pepper = DecodePepper(options.Value.KeyPepperBase64);
    }

    public string Generate()
    {
        var bytes = RandomNumberGenerator.GetBytes(24);
        var body = Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');

        return $"{Prefix}{body}";
    }

    public string Hash(string apiKey)
    {
        using var hmac = new HMACSHA256(_pepper);
        var bytes = hmac.ComputeHash(Encoding.UTF8.GetBytes(apiKey));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public bool Verify(string apiKey, string hash)
    {
        if (hash.Length != 64)
            return false;

        try
        {
            var expected = Convert.FromHexString(hash);
            var actual = Convert.FromHexString(Hash(apiKey));
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        catch (FormatException)
        {
            return false;
        }
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
