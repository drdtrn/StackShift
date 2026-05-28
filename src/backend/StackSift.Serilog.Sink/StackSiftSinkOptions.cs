namespace StackSift.Serilog.Sink;

public sealed class StackSiftSinkOptions
{
    public string IngestUrl { get; set; } = string.Empty;
    public string ApiKey { get; set; } = string.Empty;
    public Guid ProjectId { get; set; }
    public Guid LogSourceId { get; set; }
    public string? ServiceName { get; set; }
    public string? HostName { get; set; }

    public int BufferSize { get; set; } = 100;
    public TimeSpan FlushInterval { get; set; } = TimeSpan.FromSeconds(2);
    public TimeSpan RequestTimeout { get; set; } = TimeSpan.FromSeconds(10);

    public int MaxRetries { get; set; } = 5;
    public TimeSpan InitialRetryDelay { get; set; } = TimeSpan.FromSeconds(1);
    public TimeSpan MaxRetryDelay { get; set; } = TimeSpan.FromSeconds(30);

    public int QueueCapacityMultiplier { get; set; } = 10;
    public TimeSpan ShutdownDrainTimeout { get; set; } = TimeSpan.FromSeconds(5);

    internal void Validate()
    {
        if (string.IsNullOrWhiteSpace(IngestUrl))
            throw new ArgumentException("StackSiftSinkOptions.IngestUrl is required.", nameof(IngestUrl));
        if (!Uri.TryCreate(IngestUrl, UriKind.Absolute, out _))
            throw new ArgumentException($"StackSiftSinkOptions.IngestUrl is not a valid absolute URL: '{IngestUrl}'.", nameof(IngestUrl));
        if (string.IsNullOrWhiteSpace(ApiKey))
            throw new ArgumentException("StackSiftSinkOptions.ApiKey is required.", nameof(ApiKey));
        if (ProjectId == Guid.Empty)
            throw new ArgumentException("StackSiftSinkOptions.ProjectId is required.", nameof(ProjectId));
        if (LogSourceId == Guid.Empty)
            throw new ArgumentException("StackSiftSinkOptions.LogSourceId is required.", nameof(LogSourceId));
        if (BufferSize < 1 || BufferSize > 1000)
            throw new ArgumentOutOfRangeException(nameof(BufferSize), "BufferSize must be in [1, 1000] (the ingest API's batch limit).");
        if (FlushInterval <= TimeSpan.Zero)
            throw new ArgumentOutOfRangeException(nameof(FlushInterval), "FlushInterval must be positive.");
        if (MaxRetries < 0)
            throw new ArgumentOutOfRangeException(nameof(MaxRetries), "MaxRetries must be non-negative.");
        if (QueueCapacityMultiplier < 1)
            throw new ArgumentOutOfRangeException(nameof(QueueCapacityMultiplier), "QueueCapacityMultiplier must be at least 1.");
    }
}
