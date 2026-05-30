using FluentValidation;

namespace StackSift.Application.Commands.Gdpr;

public sealed class CancelAccountDeletionCommandValidator : AbstractValidator<CancelAccountDeletionCommand>
{
    public CancelAccountDeletionCommandValidator()
    {
        RuleFor(x => x.Token).NotEmpty().MaximumLength(256);
    }
}
