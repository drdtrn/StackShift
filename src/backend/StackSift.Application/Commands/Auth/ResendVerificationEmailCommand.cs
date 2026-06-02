using FluentValidation;
using MediatR;
using Microsoft.Extensions.Logging;
using StackSift.Application.Interfaces;

namespace StackSift.Application.Commands.Auth;

public record ResendVerificationEmailCommand(string Email) : IRequest;

public sealed class ResendVerificationEmailCommandValidator : AbstractValidator<ResendVerificationEmailCommand>
{
    public ResendVerificationEmailCommandValidator()
    {
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(320);
    }
}

public sealed class ResendVerificationEmailCommandHandler(
    IKeycloakAdminClient keycloak,
    ILogger<ResendVerificationEmailCommandHandler> logger)
    : IRequestHandler<ResendVerificationEmailCommand>
{
    public async Task Handle(ResendVerificationEmailCommand cmd, CancellationToken ct)
    {
        var normalized = cmd.Email.Trim().ToLowerInvariant();

        // Always succeed regardless of whether the account exists or the mail send
        // fails — the endpoint must not reveal which emails are registered.
        var user = await keycloak.FindUserByEmailAsync(normalized, ct);
        if (user is null)
        {
            logger.LogInformation("Resend-verification requested for unknown email; no-op");
            return;
        }

        try
        {
            await keycloak.SendVerifyEmailAsync(user.Id, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Resend-verification: failed to send to {UserId}", user.Id);
        }
    }
}
