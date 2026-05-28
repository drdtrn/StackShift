using Serilog;
using Serilog.Configuration;
using Serilog.Events;

namespace StackSift.Serilog.Sink;

public static class StackSiftSinkExtensions
{
    public static LoggerConfiguration StackSift(
        this LoggerSinkConfiguration sinkConfiguration,
        StackSiftSinkOptions options,
        LogEventLevel restrictedToMinimumLevel = LogEventLevel.Verbose,
        HttpClient? httpClient = null)
    {
        ArgumentNullException.ThrowIfNull(sinkConfiguration);
        ArgumentNullException.ThrowIfNull(options);

        var sink = new StackSiftSink(options, httpClient);
        return sinkConfiguration.Sink(sink, restrictedToMinimumLevel);
    }

    public static LoggerConfiguration StackSift(
        this LoggerSinkConfiguration sinkConfiguration,
        string ingestUrl,
        string apiKey,
        Guid projectId,
        Guid logSourceId,
        string? serviceName = null,
        LogEventLevel restrictedToMinimumLevel = LogEventLevel.Verbose)
    {
        var options = new StackSiftSinkOptions
        {
            IngestUrl = ingestUrl,
            ApiKey = apiKey,
            ProjectId = projectId,
            LogSourceId = logSourceId,
            ServiceName = serviceName,
        };
        return sinkConfiguration.StackSift(options, restrictedToMinimumLevel);
    }
}
