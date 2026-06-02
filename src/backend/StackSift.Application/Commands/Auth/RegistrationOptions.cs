namespace StackSift.Application.Commands.Auth;

public sealed class RegistrationOptions
{
    // When true, registration requires a matching pending invitation; otherwise the
    // anonymous register endpoint is open. Bound from the "Registration" config section.
    public bool InviteOnly { get; set; }
}
