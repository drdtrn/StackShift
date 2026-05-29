using StackSift.Serilog.Sink.Samples;
using Xunit;

namespace StackSift.Serilog.Sink.Tests;

public sealed class PiiRedactionEnricherTests
{
    [Theory]
    [InlineData("alice@example.com", "[redacted]")]
    [InlineData("Mail: bob.smith+filter@sub.example.co.uk", "Mail: [redacted]")]
    [InlineData("Contact a@b.cc and c@d.ee", "Contact [redacted] and [redacted]")]
    public void Redact_replaces_email_addresses(string input, string expected)
    {
        Assert.Equal(expected, PiiRedactionEnricher.Redact(input));
    }

    [Theory]
    [InlineData("client=192.168.1.1", "client=[redacted]")]
    [InlineData("from 10.0.0.5 to 10.0.0.6", "from [redacted] to [redacted]")]
    public void Redact_replaces_ipv4_addresses(string input, string expected)
    {
        Assert.Equal(expected, PiiRedactionEnricher.Redact(input));
    }

    [Theory]
    [InlineData("card=4111-1111-1111-1111", "card=[redacted]")]
    [InlineData("PAN 5500 0000 0000 0004 charged", "PAN [redacted] charged")]
    public void Redact_replaces_credit_card_numbers(string input, string expected)
    {
        Assert.Equal(expected, PiiRedactionEnricher.Redact(input));
    }

    [Fact]
    public void Redact_returns_input_unchanged_when_no_match()
    {
        const string clean = "user signed in successfully";
        Assert.Equal(clean, PiiRedactionEnricher.Redact(clean));
    }

    [Fact]
    public void Redact_handles_combined_patterns()
    {
        const string input = "user alice@example.com from 1.2.3.4";
        Assert.Equal("user [redacted] from [redacted]", PiiRedactionEnricher.Redact(input));
    }
}
