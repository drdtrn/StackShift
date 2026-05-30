using FluentValidation;

namespace StackSift.Application.Commands.Gdpr;

// No external input — the command is scoped entirely to the authenticated user.
public sealed class RequestAccountExportCommandValidator : AbstractValidator<RequestAccountExportCommand>
{
}
