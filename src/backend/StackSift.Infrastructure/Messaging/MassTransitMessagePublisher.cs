using MassTransit;
using StackSift.Application.Interfaces;

namespace StackSift.Infrastructure.Messaging;

internal sealed class MassTransitMessagePublisher(IPublishEndpoint publishEndpoint) : IMessagePublisher
{
    public Task PublishAsync<T>(T message, CancellationToken ct = default) where T : class
        => publishEndpoint.Publish(message, ct);
}
