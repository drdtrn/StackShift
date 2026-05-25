using StackSift.Domain.Interfaces;
using StackSift.Domain.ValueObjects;

namespace StackSift.Tests.Helpers;

// No-op IEmailService used in integration tests where SMTP isn't available.
// The real MailKitEmailService retries 3 times (2s/8s/32s) before giving up
// and publishing to a dead-letter exchange — both branches hang in CI where
// there's no SMTP and no RabbitMQ.
public sealed class NoOpEmailService : IEmailService
{
    public Task SendAsync(EmailMessage message, CancellationToken ct = default)
        => Task.CompletedTask;
}
