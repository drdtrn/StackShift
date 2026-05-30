using FluentAssertions;
using Microsoft.AspNetCore.Http;
using StackSift.Api.Middleware;
using Xunit;

namespace StackSift.Tests.Api;

public sealed class SecurityHeadersMiddlewareTests
{
    [Theory]
    [InlineData("X-Content-Type-Options", "nosniff")]
    [InlineData("X-Frame-Options", "DENY")]
    [InlineData("Referrer-Policy", "strict-origin-when-cross-origin")]
    [InlineData("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")]
    [InlineData("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")]
    public async Task Sets_expected_security_header(string name, string value)
    {
        var context = new DefaultHttpContext();
        var middleware = new SecurityHeadersMiddleware(_ => Task.CompletedTask);

        await middleware.InvokeAsync(context);

        context.Response.Headers[name].ToString().Should().Be(value);
    }
}
