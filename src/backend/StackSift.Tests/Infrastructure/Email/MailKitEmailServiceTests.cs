using System.Net.Sockets;
using MailKit;
using MailKit.Net.Smtp;
using MailKit.Security;
using MassTransit;
using Microsoft.Extensions.Logging.Abstractions;
using MimeKit;
using Moq;
using StackSift.Application.Messages;
using StackSift.Domain.ValueObjects;
using StackSift.Infrastructure.Email;

namespace StackSift.Tests.Infrastructure.Email;

public class MailKitEmailServiceTests
{
    // Zero-delay settings — retries run immediately without actual sleeping
    private static SmtpSettings ZeroDelaySettings() => new()
    {
        Host = "localhost",
        Port = 1025,
        FromAddress = "test@stacksift.io",
        FromName = "StackSift Test",
        UseSsl = false,
        RetryDelays = [TimeSpan.Zero, TimeSpan.Zero, TimeSpan.Zero],
    };

    private static EmailMessage TestMessage(string correlationId = "test-corr-id") => new(
        To: "user@example.com",
        Subject: "Test Alert",
        HtmlBody: "<p>Test body</p>",
        TextBody: null,
        CorrelationId: correlationId);

    // ─────────────────────────────────────────────────────────────────────────
    // Test 1: happy path — SMTP client is called exactly once
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task SendAsync_Success_CallsSmtpSendExactlyOnce()
    {
        var mockSmtp = new Mock<ISmtpClient>();
        mockSmtp.Setup(x => x.IsConnected).Returns(false);
        mockSmtp
            .Setup(x => x.ConnectAsync(
                It.IsAny<string>(), It.IsAny<int>(),
                It.IsAny<SecureSocketOptions>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        mockSmtp
            .Setup(x => x.SendAsync(
                It.IsAny<MimeMessage>(), It.IsAny<CancellationToken>(), It.IsAny<ITransferProgress?>()))
            .ReturnsAsync(string.Empty);
        mockSmtp
            .Setup(x => x.DisconnectAsync(It.IsAny<bool>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var mockPublish = new Mock<IPublishEndpoint>();
        var sut = new MailKitEmailService(
            mockSmtp.Object,
            ZeroDelaySettings(),
            mockPublish.Object,
            NullLogger<MailKitEmailService>.Instance);

        await sut.SendAsync(TestMessage());

        mockSmtp.Verify(
            x => x.SendAsync(It.IsAny<MimeMessage>(), It.IsAny<CancellationToken>(), It.IsAny<ITransferProgress?>()),
            Times.Once);
        mockPublish.Verify(
            x => x.Publish(It.IsAny<EmailDeadLetterMessage>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 2: SMTP always throws — Polly retries 3 times then publishes dead-letter
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task SendAsync_SmtpAlwaysThrows_RetriesThreeTimesAndPublishesDeadLetter()
    {
        var mockSmtp = new Mock<ISmtpClient>();
        mockSmtp.Setup(x => x.IsConnected).Returns(false);
        mockSmtp
            .Setup(x => x.ConnectAsync(
                It.IsAny<string>(), It.IsAny<int>(),
                It.IsAny<SecureSocketOptions>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new SocketException());

        var mockPublish = new Mock<IPublishEndpoint>();
        mockPublish
            .Setup(x => x.Publish(It.IsAny<EmailDeadLetterMessage>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var sut = new MailKitEmailService(
            mockSmtp.Object,
            ZeroDelaySettings(),
            mockPublish.Object,
            NullLogger<MailKitEmailService>.Instance);

        await sut.SendAsync(TestMessage());

        // 1 initial attempt + 3 retries = 4 total ConnectAsync calls
        mockSmtp.Verify(
            x => x.ConnectAsync(
                It.IsAny<string>(), It.IsAny<int>(),
                It.IsAny<SecureSocketOptions>(), It.IsAny<CancellationToken>()),
            Times.Exactly(4));

        // Dead-letter must be published exactly once after exhaustion
        mockPublish.Verify(
            x => x.Publish(It.IsAny<EmailDeadLetterMessage>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Test 3: dead-letter message carries correct To, Subject, and LastError
    // ─────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task SendAsync_SmtpAlwaysThrows_DeadLetterMessageContainsCorrectData()
    {
        const string expectedError = "Connection refused";
        var mockSmtp = new Mock<ISmtpClient>();
        mockSmtp.Setup(x => x.IsConnected).Returns(false);
        mockSmtp
            .Setup(x => x.ConnectAsync(
                It.IsAny<string>(), It.IsAny<int>(),
                It.IsAny<SecureSocketOptions>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new SocketException(111, expectedError)); // 111 = ECONNREFUSED

        EmailDeadLetterMessage? captured = null;
        var mockPublish = new Mock<IPublishEndpoint>();
        mockPublish
            .Setup(x => x.Publish(It.IsAny<EmailDeadLetterMessage>(), It.IsAny<CancellationToken>()))
            .Callback<EmailDeadLetterMessage, CancellationToken>((msg, _) => captured = msg)
            .Returns(Task.CompletedTask);

        var message = TestMessage(correlationId: "corr-42");
        var sut = new MailKitEmailService(
            mockSmtp.Object,
            ZeroDelaySettings(),
            mockPublish.Object,
            NullLogger<MailKitEmailService>.Instance);

        await sut.SendAsync(message);

        Assert.NotNull(captured);
        Assert.Equal(message.To, captured.To);
        Assert.Equal(message.Subject, captured.Subject);
        Assert.Equal(message.CorrelationId, captured.CorrelationId);
        Assert.NotNull(captured.LastError);
        Assert.True(captured.FailedAt <= DateTimeOffset.UtcNow);
    }
}
