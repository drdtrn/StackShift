using StackSift.Application.Interfaces;

namespace StackSift.Tests.Helpers;

/// <summary>
/// No-op IMessagePublisher used in integration tests where MassTransit is not running.
/// Discards all published messages silently.
/// </summary>
public sealed class NoOpMessagePublisher : IMessagePublisher
{
    public Task PublishAsync<T>(T message, CancellationToken ct = default) where T : class
        => Task.CompletedTask;
}
