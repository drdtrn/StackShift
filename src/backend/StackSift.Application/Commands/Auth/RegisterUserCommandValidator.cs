using FluentValidation;
using StackSift.Application.Interfaces;

namespace StackSift.Application.Commands.Auth;

public sealed class RegisterUserCommandValidator : AbstractValidator<RegisterUserCommand>
{
    public RegisterUserCommandValidator(IDisposableEmailBlocklist disposableEmails)
    {
        RuleFor(c => c.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(200)
            .Must(email => !disposableEmails.IsDisposable(email))
            .WithMessage("Disposable email addresses are not allowed.")
            .WithErrorCode("email_disposable");

        RuleFor(c => c.Password)
            .NotEmpty()
            .MinimumLength(12).WithMessage("Must be at least 12 characters.")
            .Matches(@"[A-Z]").WithMessage("Must contain an uppercase letter.")
            .Matches(@"[a-z]").WithMessage("Must contain a lowercase letter.")
            .Matches(@"\d").WithMessage("Must contain a digit.");

        RuleFor(c => c.DisplayName)
            .NotEmpty()
            .MinimumLength(2)
            .MaximumLength(80);
    }
}
