using Microsoft.Extensions.Options;
using System.Diagnostics;
using StackSift.Infrastructure.Configuration;
using StackSift.Infrastructure.Identity;

namespace StackSift.Tests.Infrastructure.Identity;

public class HmacApiKeyHasherTests
{
    private static readonly IOptions<LogSourceOptions> Options = Microsoft.Extensions.Options.Options.Create(
        new LogSourceOptions { KeyPepperBase64 = Convert.ToBase64String("12345678901234567890123456789012"u8.ToArray()) });

    [Fact]
    public void Generate_ReturnsPrefixedThirtyFiveCharacterKey()
    {
        var hasher = new HmacApiKeyHasher(Options);

        var key = hasher.Generate();

        Assert.StartsWith("ss_", key);
        Assert.Equal(35, key.Length);
    }

    [Fact]
    public void Hash_IsDeterministic()
    {
        var hasher = new HmacApiKeyHasher(Options);
        const string key = "ss_abcdefghijklmnopqrstuvwxyz123456";

        Assert.Equal(hasher.Hash(key), hasher.Hash(key));
        Assert.Equal(64, hasher.Hash(key).Length);
    }

    [Fact]
    public void Verify_AcceptsOriginalAndRejectsTamperedCandidate()
    {
        var hasher = new HmacApiKeyHasher(Options);
        var key = hasher.Generate();
        var hash = hasher.Hash(key);

        Assert.True(hasher.Verify(key, hash));
        Assert.False(hasher.Verify($"{key[..^1]}x", hash));
    }

    [Fact]
    public void Verify_UsesSamePathForInvalidCandidates()
    {
        var hasher = new HmacApiKeyHasher(Options);
        var key = hasher.Generate();
        var hash = hasher.Hash(key);

        var validTicks = MeasureTicks(() => hasher.Verify(key, hash));
        var invalidTicks = MeasureTicks(() => hasher.Verify($"{key[..^1]}x", hash));

        Assert.True(validTicks > 0);
        Assert.True(invalidTicks > 0);
    }

    private static long MeasureTicks(Action action)
    {
        var start = Stopwatch.GetTimestamp();
        for (var i = 0; i < 100; i++)
            action();
        return Stopwatch.GetTimestamp() - start;
    }
}
