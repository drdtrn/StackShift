using FluentAssertions;
using FluentValidation.TestHelper;
using StackSift.Application.Commands.Auth;
using StackSift.Infrastructure.Abuse;

namespace StackSift.Tests.Application.Commands.Auth;

public class RegisterUserCommandValidatorTests
{
    private readonly RegisterUserCommandValidator _validator = new(new DisposableEmailBlocklist());

    private static RegisterUserCommand Valid() =>
        new("alice@example.com", "Passw0rd!234", "Alice", IsOwner: false);

    // ── Email ────────────────────────────────────────────────────────────

    [Fact]
    public void Email_Empty_Fails()
        => _validator.TestValidate(Valid() with { Email = "" })
            .ShouldHaveValidationErrorFor(c => c.Email);

    [Fact]
    public void Email_BadFormat_Fails()
        => _validator.TestValidate(Valid() with { Email = "not-an-email" })
            .ShouldHaveValidationErrorFor(c => c.Email);

    [Fact]
    public void Email_TooLong_Fails()
        => _validator.TestValidate(Valid() with { Email = new string('a', 196) + "@x.io" })
            .ShouldHaveValidationErrorFor(c => c.Email);

    [Fact]
    public void Email_DisposableDomain_Fails()
        => _validator.TestValidate(Valid() with { Email = "throwaway@mailinator.com" })
            .ShouldHaveValidationErrorFor(c => c.Email)
            .WithErrorCode("email_disposable");

    // ── Password ─────────────────────────────────────────────────────────

    [Theory]
    [InlineData("", "Password cannot be empty.")]
    [InlineData("short1A", "Password too short.")]
    [InlineData("alllowercase1!", "Password missing uppercase.")]
    [InlineData("ALLUPPERCASE1!", "Password missing lowercase.")]
    [InlineData("MixedCaseNoDigit!", "Password missing digit.")]
    public void Password_FailureCases(string password, string label)
    {
        _ = label;
        _validator.TestValidate(Valid() with { Password = password })
            .ShouldHaveValidationErrorFor(c => c.Password);
    }

    [Fact]
    public void Password_Valid_Passes()
        => _validator.TestValidate(Valid() with { Password = "Passw0rd!234" })
            .ShouldNotHaveValidationErrorFor(c => c.Password);

    // ── DisplayName ──────────────────────────────────────────────────────

    [Fact]
    public void DisplayName_Empty_Fails()
        => _validator.TestValidate(Valid() with { DisplayName = "" })
            .ShouldHaveValidationErrorFor(c => c.DisplayName);

    [Fact]
    public void DisplayName_TooShort_Fails()
        => _validator.TestValidate(Valid() with { DisplayName = "A" })
            .ShouldHaveValidationErrorFor(c => c.DisplayName);

    [Fact]
    public void DisplayName_TooLong_Fails()
        => _validator.TestValidate(Valid() with { DisplayName = new string('x', 81) })
            .ShouldHaveValidationErrorFor(c => c.DisplayName);

    // ── Happy path ───────────────────────────────────────────────────────

    [Fact]
    public void Valid_Command_PassesAllRules()
    {
        var result = _validator.TestValidate(Valid());
        result.IsValid.Should().BeTrue();
    }
}
