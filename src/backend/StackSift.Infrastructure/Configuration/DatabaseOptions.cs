namespace StackSift.Infrastructure.Configuration;

public sealed class DatabaseOptions
{
    // When true the runtime connects as stacksift_app (NOBYPASSRLS) and the
    // TenantConnectionInterceptor manages the role/GUC per connection so RLS is
    // enforced (HTTP) or bypassed via SET ROLE (explicit system scope). False in
    // dev/test, where the connection is the bootstrap superuser.
    public bool RlsRoleSwitching { get; init; }
}
