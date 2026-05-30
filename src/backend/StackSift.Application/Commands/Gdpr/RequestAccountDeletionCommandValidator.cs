using FluentValidation;

namespace StackSift.Application.Commands.Gdpr;

public sealed class RequestAccountDeletionCommandValidator : AbstractValidator<RequestAccountDeletionCommand>
{
    public RequestAccountDeletionCommandValidator()
    {
        RuleFor(x => x.Confirmation).NotEmpty().MaximumLength(100);
    }
}
