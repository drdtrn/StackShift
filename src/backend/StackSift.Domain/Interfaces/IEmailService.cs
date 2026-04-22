using StackSift.Domain.ValueObjects;

namespace StackSift.Domain.Interfaces;

public interface IEmailService
{
    Task SendAsync(EmailMessage message, CancellationToken ct = default);
}
