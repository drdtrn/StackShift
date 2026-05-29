namespace StackSift.Application.Interfaces;

/// <summary>
/// Background-job execution of an account export build. Infrastructure
/// implements this against EF + the storage adapter; the
/// <see cref="IAccountExportEnqueuer"/> abstraction schedules a call.
/// </summary>
public interface IAccountExportJobRunner
{
    Task RunAsync(Guid requestId, CancellationToken ct);
}

/// <summary>
/// Application-layer abstraction over Hangfire enqueueing so the command
/// handler can schedule export jobs without referencing Hangfire directly.
/// </summary>
public interface IAccountExportEnqueuer
{
    void Enqueue(Guid requestId);
}
