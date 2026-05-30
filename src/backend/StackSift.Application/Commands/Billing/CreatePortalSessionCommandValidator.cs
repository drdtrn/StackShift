using FluentValidation;

namespace StackSift.Application.Commands.Billing;

public sealed class CreatePortalSessionCommandValidator : AbstractValidator<CreatePortalSessionCommand>
{
    public CreatePortalSessionCommandValidator()
    {
        RuleFor(x => x.Flow).IsInEnum();
    }
}
