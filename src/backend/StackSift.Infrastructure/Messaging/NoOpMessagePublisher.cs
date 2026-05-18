using StackSift.Application.Interfaces;

namespace StackSift.Infrastructure.Messaging;

// Placeholder until MassTransit/RabbitMQ is wired in BE-07.
public class NoOpMessagePublisher : IMessagePublisher
{
    public Task PublishAsync<T>(T message, CancellationToken ct = default) where T : class
        => Task.CompletedTask;
}
