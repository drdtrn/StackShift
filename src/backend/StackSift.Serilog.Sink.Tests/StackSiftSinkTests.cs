using System.Net;
using System.Text.Json;
using FluentAssertions;
using Serilog;
using Serilog.Events;
using Serilog.Parsing;
using StackSift.Serilog.Sink;

namespace StackSift.Serilog.Sink.Tests;

public class StackSiftSinkTests
{
    private const string IngestUrl = "https://example.test/api/v1/logs/ingest";
    private static readonly Guid ProjectId = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid LogSourceId = Guid.Parse("22222222-2222-2222-2222-222222222222");

    public StackSiftSinkTests()
    {
        StackSiftSink.ResetDroppedCountForTesting();
    }

    private static StackSiftSinkOptions MakeOptions(int bufferSize = 1, int maxRetries = 5)
        => new()
        {
            IngestUrl = IngestUrl,
            ApiKey = "ss_test-key-value-that-is-long-enough-for-validation",
            ProjectId = ProjectId,
            LogSourceId = LogSourceId,
            ServiceName = "test-svc",
            BufferSize = bufferSize,
            FlushInterval = TimeSpan.FromMilliseconds(100),
            InitialRetryDelay = TimeSpan.FromMilliseconds(20),
            MaxRetryDelay = TimeSpan.FromMilliseconds(80),
            MaxRetries = maxRetries,
            ShutdownDrainTimeout = TimeSpan.FromSeconds(2),
            RequestTimeout = TimeSpan.FromSeconds(2),
        };

    private static LogEvent MakeEvent(LogEventLevel level = LogEventLevel.Information, string message = "hello")
    {
        var parser = new MessageTemplateParser();
        var template = parser.Parse(message);
        return new LogEvent(DateTimeOffset.UtcNow, level, exception: null, template, properties: []);
    }

    private static async Task WaitForCondition(Func<bool> condition, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            if (condition()) return;
            await Task.Delay(20);
        }
    }

    [Fact]
    public async Task Emit_HappyPath_PostsBatchWithCorrectShape()
    {
        var handler = new CapturingHttpMessageHandler(HttpStatusCode.Accepted);
        using var http = new HttpClient(handler);
        using var sink = new StackSiftSink(MakeOptions(), http);

        sink.Emit(MakeEvent(LogEventLevel.Error, "checkout failed"));

        await WaitForCondition(() => handler.Requests.Count >= 1, TimeSpan.FromSeconds(3));

        handler.Requests.Should().ContainSingle();
        var req = handler.Requests[0];
        req.Method.Should().Be(HttpMethod.Post);
        req.Uri.ToString().Should().Be(IngestUrl);
        req.ApiKey.Should().StartWith("ss_");

        using var doc = JsonDocument.Parse(req.Body);
        doc.RootElement.GetProperty("projectId").GetGuid().Should().Be(ProjectId);
        doc.RootElement.GetProperty("logSourceId").GetGuid().Should().Be(LogSourceId);
        var entries = doc.RootElement.GetProperty("entries");
        entries.GetArrayLength().Should().Be(1);
        var entry = entries[0];
        entry.GetProperty("level").GetString().Should().Be("Error");
        entry.GetProperty("message").GetString().Should().Be("checkout failed");
        entry.GetProperty("serviceName").GetString().Should().Be("test-svc");
    }

    [Fact]
    public async Task Emit_401_DropsBatchAndDoesNotRetry()
    {
        var handler = new CapturingHttpMessageHandler(HttpStatusCode.Unauthorized);
        using var http = new HttpClient(handler);
        using var sink = new StackSiftSink(MakeOptions(), http);

        sink.Emit(MakeEvent());

        await WaitForCondition(() => handler.Requests.Count >= 1, TimeSpan.FromSeconds(2));
        await Task.Delay(150);

        handler.Requests.Should().ContainSingle("401 is non-retryable");
    }

    [Fact]
    public async Task Emit_429_HonoursRetryAfterHeader()
    {
        var handler = new CapturingHttpMessageHandler((_, attempt) =>
        {
            if (attempt == 1)
            {
                var resp = new HttpResponseMessage(HttpStatusCode.TooManyRequests);
                resp.Headers.RetryAfter = new System.Net.Http.Headers.RetryConditionHeaderValue(TimeSpan.FromMilliseconds(200));
                return resp;
            }
            return new HttpResponseMessage(HttpStatusCode.Accepted);
        });
        using var http = new HttpClient(handler);
        using var sink = new StackSiftSink(MakeOptions(), http);

        sink.Emit(MakeEvent());

        await WaitForCondition(() => handler.Requests.Count >= 2, TimeSpan.FromSeconds(3));

        handler.CallTimestamps.Should().HaveCountGreaterThanOrEqualTo(2);
        var gap = handler.CallTimestamps[1] - handler.CallTimestamps[0];
        gap.Should().BeGreaterThanOrEqualTo(TimeSpan.FromMilliseconds(150));
    }

    [Fact]
    public async Task Emit_500_RetriesWithExponentialBackoffAndEventuallySucceeds()
    {
        var handler = new CapturingHttpMessageHandler((_, attempt) =>
            attempt < 3
                ? new HttpResponseMessage(HttpStatusCode.InternalServerError)
                : new HttpResponseMessage(HttpStatusCode.Accepted));
        using var http = new HttpClient(handler);
        using var sink = new StackSiftSink(MakeOptions(), http);

        sink.Emit(MakeEvent());

        await WaitForCondition(() => handler.Requests.Count >= 3, TimeSpan.FromSeconds(3));

        handler.Requests.Count.Should().BeGreaterThanOrEqualTo(3);
    }

    [Fact]
    public async Task Emit_500_GivesUpAfterMaxRetriesAndIncrementsDropped()
    {
        var handler = new CapturingHttpMessageHandler(HttpStatusCode.InternalServerError);
        using var http = new HttpClient(handler);
        var opts = MakeOptions(maxRetries: 2);
        using var sink = new StackSiftSink(opts, http);

        sink.Emit(MakeEvent());

        await WaitForCondition(() => handler.Requests.Count >= 3, TimeSpan.FromSeconds(3));
        await Task.Delay(200);

        handler.Requests.Count.Should().BeGreaterThanOrEqualTo(3);
        StackSiftSink.EventsDropped.Should().BeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public async Task QueueFull_DropsAndIncrementsCounter()
    {
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var handler = new CapturingHttpMessageHandler((_, _) =>
        {
            release.Task.Wait();
            return new HttpResponseMessage(HttpStatusCode.Accepted);
        });
        using var http = new HttpClient(handler);

        var opts = MakeOptions(bufferSize: 5);
        opts.QueueCapacityMultiplier = 2;
        using var sink = new StackSiftSink(opts, http);

        // Pre-warm: emit one event so the worker grabs it and pins itself in the (blocking) send.
        sink.Emit(MakeEvent(message: "primer"));
        await WaitForCondition(() => handler.Requests.Count >= 1, TimeSpan.FromSeconds(2));

        // Now the worker is blocked inside SendAsync. Flood the channel — capacity is
        // 5 * 2 = 10, so events 11+ get dropped by the DropWrite channel.
        for (var i = 0; i < 200; i++)
        {
            sink.Emit(MakeEvent(message: $"e-{i}"));
        }

        StackSiftSink.EventsDropped.Should().BeGreaterThan(0);
        release.SetResult();
    }

    [Fact]
    public async Task Dispose_DrainsInFlightBatchesWithinTimeout()
    {
        var handler = new CapturingHttpMessageHandler(HttpStatusCode.Accepted);
        using var http = new HttpClient(handler);
        var sink = new StackSiftSink(MakeOptions(bufferSize: 3), http);

        for (var i = 0; i < 9; i++) sink.Emit(MakeEvent(message: $"e-{i}"));

        sink.Dispose();

        await Task.Delay(100);
        handler.Requests.Count.Should().BeGreaterThanOrEqualTo(1);
    }

    [Theory]
    [InlineData(LogEventLevel.Verbose, "Trace")]
    [InlineData(LogEventLevel.Debug, "Debug")]
    [InlineData(LogEventLevel.Information, "Info")]
    [InlineData(LogEventLevel.Warning, "Warning")]
    [InlineData(LogEventLevel.Error, "Error")]
    [InlineData(LogEventLevel.Fatal, "Critical")]
    public async Task LevelMapping_AllSerilogLevelsMapToStackSift(LogEventLevel input, string expected)
    {
        var handler = new CapturingHttpMessageHandler(HttpStatusCode.Accepted);
        using var http = new HttpClient(handler);
        using var sink = new StackSiftSink(MakeOptions(), http);

        sink.Emit(MakeEvent(input, "lvl"));
        await WaitForCondition(() => handler.Requests.Count >= 1, TimeSpan.FromSeconds(2));

        using var doc = JsonDocument.Parse(handler.Requests[0].Body);
        doc.RootElement.GetProperty("entries")[0].GetProperty("level").GetString().Should().Be(expected);
    }

    [Fact]
    public async Task MessageTemplate_PropertiesIncludedInMetadata()
    {
        var handler = new CapturingHttpMessageHandler(HttpStatusCode.Accepted);
        using var http = new HttpClient(handler);
        using var sink = new StackSiftSink(MakeOptions(), http);

        var parser = new MessageTemplateParser();
        var template = parser.Parse("user {UserId} ordered {Amount}");
        var props = new[]
        {
            new LogEventProperty("UserId", new ScalarValue("u_42")),
            new LogEventProperty("Amount", new ScalarValue(49.99)),
        };
        var evt = new LogEvent(DateTimeOffset.UtcNow, LogEventLevel.Information, null, template, props);
        sink.Emit(evt);

        await WaitForCondition(() => handler.Requests.Count >= 1, TimeSpan.FromSeconds(2));

        using var doc = JsonDocument.Parse(handler.Requests[0].Body);
        var metadata = doc.RootElement.GetProperty("entries")[0].GetProperty("metadata");
        metadata.GetProperty("UserId").GetString().Should().Be("u_42");
        metadata.GetProperty("Amount").GetDouble().Should().Be(49.99);
    }

    [Fact]
    public async Task ServiceName_OptionPropagatesOnEveryBatch()
    {
        var handler = new CapturingHttpMessageHandler(HttpStatusCode.Accepted);
        using var http = new HttpClient(handler);
        var opts = MakeOptions();
        opts.ServiceName = "billing-worker";
        opts.BufferSize = 2;
        using var sink = new StackSiftSink(opts, http);

        sink.Emit(MakeEvent());
        sink.Emit(MakeEvent());
        sink.Emit(MakeEvent());

        await WaitForCondition(() => handler.Requests.Count >= 2, TimeSpan.FromSeconds(3));

        foreach (var req in handler.Requests)
        {
            using var doc = JsonDocument.Parse(req.Body);
            foreach (var entry in doc.RootElement.GetProperty("entries").EnumerateArray())
            {
                entry.GetProperty("serviceName").GetString().Should().Be("billing-worker");
            }
        }
    }

    [Fact]
    public void Options_Validate_RejectsEmptyApiKeyAndIngestUrl()
    {
        var bad = new StackSiftSinkOptions { IngestUrl = "", ApiKey = "", ProjectId = ProjectId, LogSourceId = LogSourceId };
        var ex = Assert.Throws<ArgumentException>(() => bad.Validate());
        ex.ParamName.Should().Be("IngestUrl");

        var bad2 = new StackSiftSinkOptions { IngestUrl = "https://x", ApiKey = "", ProjectId = ProjectId, LogSourceId = LogSourceId };
        var ex2 = Assert.Throws<ArgumentException>(() => bad2.Validate());
        ex2.ParamName.Should().Be("ApiKey");
    }
}
