using System.Security.Cryptography;

namespace StackSift.Application.Common;

public static class TokenGenerator
{
    public static string UrlSafe(int bytes = 24)
    {
        if (bytes <= 0) throw new ArgumentOutOfRangeException(nameof(bytes));
        var buffer = RandomNumberGenerator.GetBytes(bytes);
        return Convert.ToBase64String(buffer)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }
}
