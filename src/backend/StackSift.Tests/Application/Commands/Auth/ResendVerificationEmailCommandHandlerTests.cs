using FluentAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using StackSift.Application.Commands.Auth;
using StackSift.Application.Interfaces;

namespace StackSift.Tests.Application.Commands.Auth;

public class ResendVerificationEmailCommandHandlerTests
{
    private readonly Mock<IKeycloakAdminClient> _kc = new();

    private ResendVerificationEmailCommandHandler NewHandler() =>
        new(_kc.Object, NullLogger<ResendVerificationEmailCommandHandler>.Instance);

    [Fact]
    public async Task KnownEmail_SendsVerificationEmail()
    {
        var userId = Guid.NewGuid();
        _kc.Setup(k => k.FindUserByEmailAsync("user@example.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new KeycloakUserSummary(userId, "user@example.com", "User", "viewer", null));

        await NewHandler().Handle(new ResendVerificationEmailCommand("  User@Example.com "), default);

        _kc.Verify(k => k.SendVerifyEmailAsync(userId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UnknownEmail_IsNoOp_AndDoesNotThrow()
    {
        _kc.Setup(k => k.FindUserByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((KeycloakUserSummary?)null);

        await NewHandler().Handle(new ResendVerificationEmailCommand("ghost@example.com"), default);

        _kc.Verify(k => k.SendVerifyEmailAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task SendFailure_IsSwallowed()
    {
        var userId = Guid.NewGuid();
        _kc.Setup(k => k.FindUserByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new KeycloakUserSummary(userId, "user@example.com", "User", "viewer", null));
        _kc.Setup(k => k.SendVerifyEmailAsync(userId, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("smtp down"));

        var act = async () => await NewHandler().Handle(
            new ResendVerificationEmailCommand("user@example.com"), default);

        await act.Should().NotThrowAsync();
    }
}
