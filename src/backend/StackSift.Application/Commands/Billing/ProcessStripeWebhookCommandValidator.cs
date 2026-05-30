using FluentValidation;

namespace StackSift.Application.Commands.Billing;

public sealed class ProcessStripeWebhookCommandValidator : AbstractValidator<ProcessStripeWebhookCommand>
{
    public ProcessStripeWebhookCommandValidator()
    {
        RuleFor(x => x.RawBody).NotEmpty();
        RuleFor(x => x.Signature).NotEmpty().MaximumLength(1024);
    }
}
