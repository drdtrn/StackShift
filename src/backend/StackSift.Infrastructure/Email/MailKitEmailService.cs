using System.Net.Sockets;
using System.Reflection;
using MassTransit;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using Microsoft.Extensions.Logging;
using Polly;
using Polly.Retry;
using StackSift.Application.Messages;
using StackSift.Domain.Interfaces;
using StackSift.Domain.ValueObjects;

namespace StackSift.Infrastructure.Email;

public sealed class MailKitEmailService(
    ISmtpClient smtpClient,
    SmtpSettings settings,
    IPublishEndpoint publishEndpoint,
    ILogger<MailKitEmailService> logger)
    : IEmailService
{
    private readonly ResiliencePipeline _retryPipeline = BuildRetryPipeline(settings.RetryDelays);

    public async Task SendAsync(EmailMessage message, CancellationToken ct = default)
    {
        var mimeMessage = BuildMimeMessage(message);

        try
        {
            await _retryPipeline.ExecuteAsync(async token =>
            {
                try
                {
                    await smtpClient.ConnectAsync(
                        settings.Host,
                        settings.Port,
                        settings.UseSsl ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.None,
                        token);

                    if (!string.IsNullOrEmpty(settings.Username))
                        await smtpClient.AuthenticateAsync(settings.Username, settings.Password ?? string.Empty, token);

                    await smtpClient.SendAsync(mimeMessage, token);
                }
                finally
                {
                    if (smtpClient.IsConnected)
                        await smtpClient.DisconnectAsync(true, token);
                }
            }, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex,
                "Email to {To} failed after {Attempts} attempts — routing to dead-letter queue. CorrelationId: {CorrelationId}",
                message.To, settings.RetryDelays.Length + 1, message.CorrelationId);

            await publishEndpoint.Publish(new EmailDeadLetterMessage(
                To: message.To,
                Subject: message.Subject,
                HtmlBody: message.HtmlBody,
                CorrelationId: message.CorrelationId,
                FailedAt: DateTimeOffset.UtcNow,
                LastError: ex.Message), ct);
        }
    }

    public static string LoadTemplate(string templateName)
    {
        var assembly = Assembly.GetExecutingAssembly();
        var resourceName = $"StackSift.Infrastructure.Email.Templates.{templateName}";

        using var stream = assembly.GetManifestResourceStream(resourceName)
            ?? throw new InvalidOperationException($"Embedded resource '{resourceName}' not found.");

        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }

    private MimeMessage BuildMimeMessage(EmailMessage message)
    {
        var mime = new MimeMessage();
        mime.From.Add(new MailboxAddress(settings.FromName, settings.FromAddress));
        mime.To.Add(MailboxAddress.Parse(message.To));
        mime.Subject = message.Subject;
        mime.Body = new BodyBuilder
        {
            HtmlBody = message.HtmlBody,
            TextBody = message.TextBody,
        }.ToMessageBody();
        return mime;
    }

    private static ResiliencePipeline BuildRetryPipeline(TimeSpan[] delays) =>
        new ResiliencePipelineBuilder()
            .AddRetry(new RetryStrategyOptions
            {
                MaxRetryAttempts = delays.Length,
                DelayGenerator = args => new ValueTask<TimeSpan?>(
                    args.AttemptNumber < delays.Length
                        ? delays[args.AttemptNumber]
                        : delays[^1]),
                ShouldHandle = new PredicateBuilder()
                    .Handle<SmtpCommandException>()
                    .Handle<MailKit.ProtocolException>()
                    .Handle<SocketException>(),
            })
            .Build();
}
