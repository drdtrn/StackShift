using System.Diagnostics;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Serilog;
using Serilog.Core;
using Serilog.Events;
using StackSift.Api.Middleware;

namespace StackSift.Tests.Middleware;

public sealed class ObservabilityEnrichmentMiddlewareTests
{
    [Fact]
    public async Task InvokeAsync_PushesTraceSpanOrgAndUserOntoLogContext()
    {
        var orgId = Guid.NewGuid().ToString();
        var userId = Guid.NewGuid().ToString();
        var sink = new CapturingSink();
        var originalLogger = Log.Logger;

        Log.Logger = new LoggerConfiguration()
            .Enrich.FromLogContext()
            .WriteTo.Sink(sink)
            .CreateLogger();

        using var activity = new Activity("observability-test");
        activity.Start();

        try
        {
            var context = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim("organization_id", orgId),
                        new Claim("sub", userId),
                    ],
                    "test")),
            };

            var middleware = new ObservabilityEnrichmentMiddleware(_ =>
            {
                Log.Information("captured");
                return Task.CompletedTask;
            });

            await middleware.InvokeAsync(context);

            var logEvent = Assert.Single(sink.Events);
            Assert.Equal(activity.TraceId.ToString(), ScalarValue(logEvent, "TraceId"));
            Assert.Equal(activity.SpanId.ToString(), ScalarValue(logEvent, "SpanId"));
            Assert.Equal(orgId, ScalarValue(logEvent, "OrgId"));
            Assert.Equal(userId, ScalarValue(logEvent, "UserId"));
        }
        finally
        {
            activity.Stop();
            Log.Logger = originalLogger;
        }
    }

    private static string ScalarValue(LogEvent logEvent, string propertyName)
    {
        var property = Assert.IsType<ScalarValue>(logEvent.Properties[propertyName]);
        return Assert.IsType<string>(property.Value);
    }

    private sealed class CapturingSink : ILogEventSink
    {
        public List<LogEvent> Events { get; } = [];

        public void Emit(LogEvent logEvent) => Events.Add(logEvent);
    }
}
